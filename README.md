# Signa Invest · CRM

App interno da Signa Invest em **app.signainvest.com**. Acesso só para contas `@signainvest.com` (login Microsoft / Entra ID).

## O que tem
- **Contatos**: nome, empresa, e-mail, telefone, tipo (investidor / originador / outro), observações.
- **Oportunidades**: nome, originador, classe de ativo, onshore/offshore, valor buscado, status, observações.
- **Deals fechados**: oportunidade, investidor, valor, data, comissão (%).

## Como funciona
| Parte | Onde | Custo |
|---|---|---|
| Site (React + Vite) — `frontend/` | Azure Static Web Apps `swa-signa-app` (Free) | US$ 0 |
| API (Python, Azure Functions) — `api/` | gerenciada pelo Static Web Apps | US$ 0 |
| Banco — Azure SQL `sql-signa-app/signa-crm` | serverless, oferta gratuita, pausa sozinho | US$ 0 |

Tudo no grupo de recursos `rg-signa-app`, assinatura da Signa (tenant `c80b2884-…`). Nada compartilhado com a Baluarte.

- O esquema do banco é criado pela própria API na primeira chamada (`function_app.py`).
- O banco gratuito dorme quando ninguém usa: o primeiro acesso do dia pode levar até ~1 minuto.
- Cada `push` em `main` publica sozinho (`.github/workflows/deploy.yml`).
- Visual: Brand Kit da Signa (tokens, fontes Cormorant Garamond e Source Sans 3, logos SVG).

## Rodar localmente
```bash
cd frontend && npm install && npm run dev
```
A API precisa do Azure Functions Core Tools e das variáveis `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`.
