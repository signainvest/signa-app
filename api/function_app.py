"""API do CRM da Signa Invest (Azure Functions, Python v2).

Acesso: somente usuários autenticados pelo Entra ID com e-mail @signainvest.com.
Banco: Azure SQL (serverless, free offer). O esquema é criado na primeira chamada.
"""
import base64
import datetime as dt
import decimal
import json
import logging
import os
import time

import azure.functions as func
import pymssql

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

DOMINIO = os.environ.get("ALLOWED_EMAIL_DOMAIN", "signainvest.com").lower()
TENANT_ID = os.environ.get("ALLOWED_TENANT_ID", "").lower()

TIPOS_CONTATO = {"investidor", "originador", "outro"}
STATUS_OPORTUNIDADE = {"em_analise", "em_captacao", "encerrada", "descartada"}
JURISDICOES = {"onshore", "offshore"}

SCHEMA = [
    """
    IF OBJECT_ID('dbo.contatos') IS NULL
    CREATE TABLE dbo.contatos (
        id INT IDENTITY PRIMARY KEY,
        nome NVARCHAR(200) NOT NULL,
        empresa NVARCHAR(200) NULL,
        email NVARCHAR(200) NULL,
        telefone NVARCHAR(50) NULL,
        tipo NVARCHAR(20) NOT NULL DEFAULT 'outro',
        observacoes NVARCHAR(MAX) NULL,
        criado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        criado_por NVARCHAR(200) NULL,
        atualizado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        atualizado_por NVARCHAR(200) NULL
    )
    """,
    """
    IF OBJECT_ID('dbo.oportunidades') IS NULL
    CREATE TABLE dbo.oportunidades (
        id INT IDENTITY PRIMARY KEY,
        nome NVARCHAR(200) NOT NULL,
        originador_id INT NULL REFERENCES dbo.contatos(id),
        classe_ativo NVARCHAR(100) NULL,
        jurisdicao NVARCHAR(10) NOT NULL DEFAULT 'onshore',
        total_captacao DECIMAL(18,2) NULL,
        ticket_minimo DECIMAL(18,2) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'em_analise',
        observacoes NVARCHAR(MAX) NULL,
        criado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        criado_por NVARCHAR(200) NULL,
        atualizado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        atualizado_por NVARCHAR(200) NULL
    )
    """,
    """
    IF OBJECT_ID('dbo.deals') IS NULL
    CREATE TABLE dbo.deals (
        id INT IDENTITY PRIMARY KEY,
        oportunidade_id INT NOT NULL REFERENCES dbo.oportunidades(id),
        investidor_id INT NULL REFERENCES dbo.contatos(id),
        valor DECIMAL(18,2) NULL,
        data_fechamento DATE NULL,
        comissao_pct DECIMAL(7,4) NULL,
        criado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        criado_por NVARCHAR(200) NULL,
        atualizado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        atualizado_por NVARCHAR(200) NULL
    )
    """,
    # v0.2: "Valor buscado" virou "Total da captação" e entrou "Ticket mínimo"
    """
    IF COL_LENGTH('dbo.oportunidades','valor_buscado') IS NOT NULL
       AND COL_LENGTH('dbo.oportunidades','total_captacao') IS NULL
    EXEC sp_rename 'dbo.oportunidades.valor_buscado', 'total_captacao', 'COLUMN'
    """,
    """
    IF COL_LENGTH('dbo.oportunidades','ticket_minimo') IS NULL
    ALTER TABLE dbo.oportunidades ADD ticket_minimo DECIMAL(18,2) NULL
    """,
]

_schema_ok = False


# ---------------------------------------------------------------- utilidades

class HttpErro(Exception):
    def __init__(self, status, mensagem):
        super().__init__(mensagem)
        self.status = status
        self.mensagem = mensagem


def _json_default(o):
    if isinstance(o, decimal.Decimal):
        return float(o)
    if isinstance(o, (dt.date, dt.datetime)):
        return o.isoformat()
    raise TypeError(type(o))


def resposta(corpo, status=200):
    return func.HttpResponse(
        json.dumps(corpo, default=_json_default, ensure_ascii=False),
        status_code=status,
        mimetype="application/json",
        headers={"Cache-Control": "no-store"},
    )


def usuario(req: func.HttpRequest) -> str:
    """Valida o principal injetado pelo Static Web Apps e devolve o e-mail."""
    bruto = req.headers.get("x-ms-client-principal")
    if not bruto:
        raise HttpErro(401, "Faça login para continuar.")
    try:
        principal = json.loads(base64.b64decode(bruto))
    except Exception:
        raise HttpErro(401, "Sessão inválida.")
    if principal.get("identityProvider") != "aad":
        raise HttpErro(403, "Use sua conta Microsoft da Signa Invest.")
    email = (principal.get("userDetails") or "").strip().lower()
    if not email.endswith("@" + DOMINIO):
        logging.warning("Acesso negado: principal=%s", principal)
        raise HttpErro(403, f"Acesso restrito a contas @{DOMINIO}. (recebido: '{email}', rota: {req.url})")
    if TENANT_ID:
        claims = {c.get("typ"): c.get("val") for c in principal.get("claims") or []}
        tid = (claims.get("http://schemas.microsoft.com/identity/claims/tenantid")
               or claims.get("tid") or "").lower()
        if tid and tid != TENANT_ID:
            raise HttpErro(403, "Conta fora do diretório da Signa Invest.")
    return email


def conectar():
    """Conecta ao Azure SQL. O banco gratuito 'dorme'; tenta por até ~35 s."""
    global _schema_ok
    prazo = time.time() + 35
    ultimo = None
    while time.time() < prazo:
        try:
            conn = pymssql.connect(
                server=os.environ["SQL_SERVER"],
                user=os.environ["SQL_USER"],
                password=os.environ["SQL_PASSWORD"],
                database=os.environ["SQL_DATABASE"],
                port=1433,
                login_timeout=15,
                timeout=25,
                tds_version="7.4",
                as_dict=True,
                autocommit=False,
            )
            if not _schema_ok:
                cur = conn.cursor()
                for ddl in SCHEMA:
                    cur.execute(ddl)
                conn.commit()
                _schema_ok = True
            return conn
        except pymssql.Error as e:  # banco acordando, etc.
            ultimo = e
            logging.warning("SQL indisponível, tentando de novo: %s", e)
            time.sleep(4)
    logging.error("SQL não respondeu: %s", ultimo)
    raise HttpErro(503, "O banco está acordando. Tente de novo em alguns segundos.")


def corpo_json(req):
    try:
        dados = req.get_json()
    except ValueError:
        raise HttpErro(400, "Dados inválidos.")
    if not isinstance(dados, dict):
        raise HttpErro(400, "Dados inválidos.")
    return dados


def texto(d, campo, obrigatorio=False, maximo=200):
    v = d.get(campo)
    v = (str(v).strip() if v is not None else "") or None
    if obrigatorio and not v:
        raise HttpErro(400, f"O campo '{campo}' é obrigatório.")
    if v and maximo and len(v) > maximo:
        raise HttpErro(400, f"O campo '{campo}' é longo demais.")
    return v


def numero(d, campo):
    v = d.get(campo)
    if v in (None, ""):
        return None
    try:
        return decimal.Decimal(str(v))
    except decimal.InvalidOperation:
        raise HttpErro(400, f"O campo '{campo}' precisa ser um número.")


def inteiro(d, campo, obrigatorio=False):
    v = d.get(campo)
    if v in (None, ""):
        if obrigatorio:
            raise HttpErro(400, f"O campo '{campo}' é obrigatório.")
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        raise HttpErro(400, f"O campo '{campo}' é inválido.")


def escolha(d, campo, opcoes, padrao):
    v = (d.get(campo) or padrao)
    v = str(v).strip().lower()
    if v not in opcoes:
        raise HttpErro(400, f"Valor inválido em '{campo}'.")
    return v


def data(d, campo):
    v = d.get(campo)
    if not v:
        return None
    try:
        return dt.date.fromisoformat(str(v)[:10])
    except ValueError:
        raise HttpErro(400, f"Data inválida em '{campo}'.")


def tratar(fn):
    """Envolve o handler: autenticação, conexão e erros."""
    def wrapper(req: func.HttpRequest) -> func.HttpResponse:
        conn = None
        try:
            email = usuario(req)
            conn = conectar()
            out = fn(req, conn, email)
            conn.commit()
            return out
        except HttpErro as e:
            if conn:
                conn.rollback()
            return resposta({"erro": e.mensagem}, e.status)
        except pymssql.IntegrityError as e:
            if conn:
                conn.rollback()
            logging.warning("Integridade: %s", e)
            return resposta({"erro": "Este registro está ligado a outros e não pode ser removido."}, 409)
        except Exception:
            if conn:
                conn.rollback()
            logging.exception("Erro inesperado")
            return resposta({"erro": "Erro inesperado. Tente de novo."}, 500)
        finally:
            if conn:
                conn.close()
    wrapper.__name__ = fn.__name__
    return wrapper


def um(cur, sql, params):
    cur.execute(sql, params)
    return cur.fetchone()


# ---------------------------------------------------------------- rotas

@app.route(route="me", methods=["GET"])
def me(req: func.HttpRequest) -> func.HttpResponse:
    try:
        return resposta({"email": usuario(req)})
    except HttpErro as e:
        return resposta({"erro": e.mensagem}, e.status)


# --- contatos

SQL_CONTATO = "SELECT id, nome, empresa, email, telefone, tipo, observacoes, atualizado_em FROM dbo.contatos"


def campos_contato(d):
    return (
        texto(d, "nome", obrigatorio=True),
        texto(d, "empresa"),
        texto(d, "email"),
        texto(d, "telefone", maximo=50),
        escolha(d, "tipo", TIPOS_CONTATO, "outro"),
        texto(d, "observacoes", maximo=None),
    )


@app.route(route="contatos", methods=["GET", "POST"])
@tratar
def contatos(req, conn, email):
    cur = conn.cursor()
    if req.method == "GET":
        cur.execute(SQL_CONTATO + " ORDER BY nome")
        return resposta(cur.fetchall())
    c = campos_contato(corpo_json(req))
    novo = um(cur, "INSERT INTO dbo.contatos (nome, empresa, email, telefone, tipo, observacoes, criado_por, atualizado_por)"
                   " OUTPUT INSERTED.id VALUES (%s,%s,%s,%s,%s,%s,%s,%s)", c + (email, email))
    return resposta(um(cur, SQL_CONTATO + " WHERE id=%s", (novo["id"],)), 201)


@app.route(route="contatos/{id:int}", methods=["PUT", "DELETE"])
@tratar
def contato(req, conn, email):
    cur = conn.cursor()
    i = int(req.route_params["id"])
    if req.method == "DELETE":
        cur.execute("DELETE FROM dbo.contatos WHERE id=%s", (i,))
        return resposta({"ok": True})
    c = campos_contato(corpo_json(req))
    cur.execute("UPDATE dbo.contatos SET nome=%s, empresa=%s, email=%s, telefone=%s, tipo=%s, observacoes=%s,"
                " atualizado_em=SYSUTCDATETIME(), atualizado_por=%s WHERE id=%s", c + (email, i))
    linha = um(cur, SQL_CONTATO + " WHERE id=%s", (i,))
    if not linha:
        raise HttpErro(404, "Contato não encontrado.")
    return resposta(linha)


# --- oportunidades

SQL_OPORTUNIDADE = """
SELECT o.id, o.nome, o.originador_id, c.nome AS originador_nome, c.empresa AS originador_empresa, o.classe_ativo, o.jurisdicao,
       o.total_captacao, o.ticket_minimo, o.status, o.observacoes, o.atualizado_em
FROM dbo.oportunidades o LEFT JOIN dbo.contatos c ON c.id = o.originador_id
"""


def campos_oportunidade(d):
    return (
        texto(d, "nome", obrigatorio=True),
        inteiro(d, "originador_id"),
        texto(d, "classe_ativo", maximo=100),
        escolha(d, "jurisdicao", JURISDICOES, "onshore"),
        numero(d, "total_captacao"),
        numero(d, "ticket_minimo"),
        escolha(d, "status", STATUS_OPORTUNIDADE, "em_analise"),
        texto(d, "observacoes", maximo=None),
    )


@app.route(route="oportunidades", methods=["GET", "POST"])
@tratar
def oportunidades(req, conn, email):
    cur = conn.cursor()
    if req.method == "GET":
        cur.execute(SQL_OPORTUNIDADE + " ORDER BY o.atualizado_em DESC")
        return resposta(cur.fetchall())
    c = campos_oportunidade(corpo_json(req))
    novo = um(cur, "INSERT INTO dbo.oportunidades (nome, originador_id, classe_ativo, jurisdicao, total_captacao, ticket_minimo,"
                   " status, observacoes, criado_por, atualizado_por) OUTPUT INSERTED.id"
                   " VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
              c + (email, email))
    return resposta(um(cur, SQL_OPORTUNIDADE + " WHERE o.id=%s", (novo["id"],)), 201)


@app.route(route="oportunidades/{id:int}", methods=["PUT", "DELETE"])
@tratar
def oportunidade(req, conn, email):
    cur = conn.cursor()
    i = int(req.route_params["id"])
    if req.method == "DELETE":
        cur.execute("DELETE FROM dbo.oportunidades WHERE id=%s", (i,))
        return resposta({"ok": True})
    c = campos_oportunidade(corpo_json(req))
    cur.execute("UPDATE dbo.oportunidades SET nome=%s, originador_id=%s, classe_ativo=%s, jurisdicao=%s,"
                " total_captacao=%s, ticket_minimo=%s, status=%s, observacoes=%s, atualizado_em=SYSUTCDATETIME(), atualizado_por=%s"
                " WHERE id=%s", c + (email, i))
    linha = um(cur, SQL_OPORTUNIDADE + " WHERE o.id=%s", (i,))
    if not linha:
        raise HttpErro(404, "Oportunidade não encontrada.")
    return resposta(linha)


# --- deals fechados

SQL_DEAL = """
SELECT d.id, d.oportunidade_id, o.nome AS oportunidade_nome, o.jurisdicao,
       d.investidor_id, c.nome AS investidor_nome, d.valor, d.data_fechamento, d.comissao_pct, d.atualizado_em
FROM dbo.deals d
JOIN dbo.oportunidades o ON o.id = d.oportunidade_id
LEFT JOIN dbo.contatos c ON c.id = d.investidor_id
"""


def campos_deal(d):
    pct = numero(d, "comissao_pct")
    if pct is not None and not (0 <= pct <= 100):
        raise HttpErro(400, "A comissão deve estar entre 0 e 100%.")
    return (
        inteiro(d, "oportunidade_id", obrigatorio=True),
        inteiro(d, "investidor_id"),
        numero(d, "valor"),
        data(d, "data_fechamento"),
        pct,
    )


@app.route(route="deals", methods=["GET", "POST"])
@tratar
def deals(req, conn, email):
    cur = conn.cursor()
    if req.method == "GET":
        cur.execute(SQL_DEAL + " ORDER BY d.data_fechamento DESC, d.id DESC")
        return resposta(cur.fetchall())
    c = campos_deal(corpo_json(req))
    novo = um(cur, "INSERT INTO dbo.deals (oportunidade_id, investidor_id, valor, data_fechamento, comissao_pct,"
                   " criado_por, atualizado_por) OUTPUT INSERTED.id VALUES (%s,%s,%s,%s,%s,%s,%s)", c + (email, email))
    return resposta(um(cur, SQL_DEAL + " WHERE d.id=%s", (novo["id"],)), 201)


@app.route(route="deals/{id:int}", methods=["PUT", "DELETE"])
@tratar
def deal(req, conn, email):
    cur = conn.cursor()
    i = int(req.route_params["id"])
    if req.method == "DELETE":
        cur.execute("DELETE FROM dbo.deals WHERE id=%s", (i,))
        return resposta({"ok": True})
    c = campos_deal(corpo_json(req))
    cur.execute("UPDATE dbo.deals SET oportunidade_id=%s, investidor_id=%s, valor=%s, data_fechamento=%s,"
                " comissao_pct=%s, atualizado_em=SYSUTCDATETIME(), atualizado_por=%s WHERE id=%s", c + (email, i))
    linha = um(cur, SQL_DEAL + " WHERE d.id=%s", (i,))
    if not linha:
        raise HttpErro(404, "Deal não encontrado.")
    return resposta(linha)
