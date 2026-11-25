export type TipoContato = 'investidor' | 'originador' | 'outro'
export type Status = 'em_analise' | 'em_captacao' | 'encerrada' | 'descartada'
export type Jurisdicao = 'onshore' | 'offshore'

export interface Contato {
  id: number; nome: string; empresa: string | null; email: string | null; telefone: string | null
  tipo: TipoContato; observacoes: string | null
}
export interface Oportunidade {
  id: number; nome: string; originador_id: number | null; originador_nome: string | null; originador_empresa: string | null
  classe_ativo: string | null; jurisdicao: Jurisdicao; total_captacao: number | null; ticket_minimo: number | null
  status: Status
  observacoes: string | null
}
export interface Deal {
  id: number; oportunidade_id: number; oportunidade_nome: string; jurisdicao: Jurisdicao
  investidor_id: number | null; investidor_nome: string | null; valor: number | null
  data_fechamento: string | null; comissao_pct: number | null
}

export type JurisAnotacao = 'onshore' | 'offshore' | 'ambos'
export interface Anotacao {
  id: number; contato_id: number; contato_nome: string; contato_empresa: string | null; contato_tipo: TipoContato
  data: string; texto: string; classes: string[]; jurisdicao: JurisAnotacao | null
  criado_por: string | null; criado_em: string; atualizado_por: string | null; atualizado_em: string
}

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem) }
}

async function pedir<T>(caminho: string, metodo = 'GET', corpo?: unknown, tentativa = 0): Promise<T> {
  const r = await fetch('/api/' + caminho, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
    credentials: 'same-origin',
  })
  // o banco gratuito "dorme": na primeira chamada do dia pode demorar
  if (r.status === 503 && tentativa < 3 && metodo === 'GET') {
    await new Promise(ok => setTimeout(ok, 3000))
    return pedir<T>(caminho, metodo, corpo, tentativa + 1)
  }
  if (r.status === 401) { window.location.href = '/login'; throw new ErroApi(401, 'Sessão expirada.') }
  let dados: any = null
  try { dados = await r.json() } catch { /* sem corpo */ }
  if (!r.ok) throw new ErroApi(r.status, dados?.erro || 'Algo deu errado. Tente de novo.')
  return dados as T
}

export const api = {
  eu: () => pedir<{ email: string }>('me'),
  listar: <T>(recurso: string) => pedir<T[]>(recurso),
  // o recurso pode levar filtros: 'anotacoes?contato_id=3'
  salvar: <T>(recurso: string, dados: object, id?: number) =>
    pedir<T>(id ? `${recurso}/${id}` : recurso, id ? 'PUT' : 'POST', dados),
  remover: (recurso: string, id: number) => pedir<{ ok: true }>(`${recurso}/${id}`, 'DELETE'),
}

// -------- vocabulário e formatação

export const TIPOS: Record<TipoContato, string> = { investidor: 'Investidor', originador: 'Originador', outro: 'Outro' }
export const STATUS: Record<Status, string> = {
  em_analise: 'Em análise', em_captacao: 'Em captação', encerrada: 'Encerrada', descartada: 'Descartada',
}
export const JURISDICOES: Record<Jurisdicao, string> = { onshore: 'Onshore', offshore: 'Offshore' }
export const JURIS_ANOTACAO: Record<JurisAnotacao, string> = { onshore: 'Onshore', offshore: 'Offshore', ambos: 'Ambos' }

// Lista provisória — substituir pelas classes usadas na Baluarte.
export const CLASSES_ATIVO = [
  'Renda Fixa', 'Crédito Privado', 'Renda Variável', 'Multimercado', 'Private Equity',
  'Venture Capital', 'Imobiliário', 'Infraestrutura', 'Outros',
]

export function dinheiro(v: number | null | undefined, j: Jurisdicao = 'onshore') {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: j === 'offshore' ? 'USD' : 'BRL', maximumFractionDigits: 0,
  }).format(v)
}
export function dataBr(v: string | null) {
  if (!v) return '—'
  const [a, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}
export function pct(v: number | null) {
  return v == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v) + '%'
}
export function sem(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
