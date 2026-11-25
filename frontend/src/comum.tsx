import { ReactNode, useCallback, useEffect, useState } from 'react'
import { api, ErroApi } from './api'
import { Icone } from './icones'

/** Carrega uma lista da API e permite recarregar. */
export function useLista<T>(recurso: string) {
  const [itens, setItens] = useState<T[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const recarregar = useCallback(async () => {
    try { setErro(null); setItens(await api.listar<T>(recurso)) }
    catch (e) { setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar.') }
  }, [recurso])
  useEffect(() => { recarregar() }, [recarregar])
  return { itens, erro, recarregar }
}

interface PainelProps<F> {
  titulo: string
  subtitulo?: string
  recurso: string
  id?: number
  inicial: F
  rotuloSalvar: string
  aoFechar: () => void
  aoSalvar: () => void
  children: (f: F, set: <K extends keyof F>(k: K, v: F[K]) => void) => ReactNode
}

/** Painel lateral com formulário: criar, editar e excluir. */
export function Painel<F extends object>(p: PainelProps<F>) {
  const { titulo, subtitulo, recurso, id, inicial, rotuloSalvar, aoFechar, aoSalvar, children } = p
  const [form, setForm] = useState<F>(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const set = <K extends keyof F>(k: K, v: F[K]) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aoFechar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true); setErro(null)
    try { await api.salvar(recurso, form, id); aoSalvar() }
    catch (x) { setErro(x instanceof ErroApi ? x.message : 'Não foi possível salvar. Tente de novo.') }
    finally { setOcupado(false) }
  }
  async function excluir() {
    if (!id || !window.confirm('Excluir este registro? Essa ação não pode ser desfeita.')) return
    setOcupado(true); setErro(null)
    try { await api.remover(recurso, id); aoSalvar() }
    catch (x) { setErro(x instanceof ErroApi ? x.message : 'Não foi possível excluir.') }
    finally { setOcupado(false) }
  }

  return (
    <div className="fundo" onMouseDown={e => { if (e.target === e.currentTarget) aoFechar() }}>
      <form className="painel" onSubmit={salvar} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="painel-topo">
          <div><h2>{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
          <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar">{Icone.fechar}</button>
        </div>
        <div className="painel-corpo">
          {erro && <div className="erro" role="alert">{erro}</div>}
          {children(form, set)}
        </div>
        <div className="painel-pe">
          {id ? <button type="button" className="botao perigo" onClick={excluir} disabled={ocupado}>Excluir</button> : <span />}
          <div>
            <button type="button" className="botao claro" onClick={aoFechar} disabled={ocupado}>Cancelar</button>
            <button type="submit" className="botao" disabled={ocupado}>{ocupado ? 'Salvando…' : rotuloSalvar}</button>
          </div>
        </div>
      </form>
    </div>
  )
}

const hoje = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

export function Cabeca({ titulo, sub, acao }: { titulo: string; sub?: string; acao: ReactNode }) {
  return (
    <div className="cabeca">
      <div>
        <p className="data">{hoje.charAt(0).toUpperCase() + hoje.slice(1)}</p>
        <h1 className="titulo">{titulo}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {acao}
    </div>
  )
}

export function Ferramentas<K extends string>({ filtros, ativo, setAtivo, busca, setBusca, dica }: {
  filtros: { id: K; rotulo: string; n: number }[]; ativo: K; setAtivo: (k: K) => void
  busca: string; setBusca: (s: string) => void; dica: string
}) {
  return (
    <div className="ferramentas">
      <div className="filtros" role="group" aria-label="Filtrar">
        {filtros.map(f => (
          <button key={f.id} type="button" className="filtro" aria-pressed={f.id === ativo} onClick={() => setAtivo(f.id)}>
            {f.rotulo}<span className="n">{f.n}</span>
          </button>
        ))}
      </div>
      <label className="busca">
        {Icone.busca}
        <input type="search" placeholder={dica} aria-label="Buscar" value={busca} onChange={e => setBusca(e.target.value)} />
      </label>
    </div>
  )
}

export function Estado({ itens, erro, vazio, children }: {
  itens: unknown[] | null; erro: string | null; vazio: ReactNode; children: ReactNode
}) {
  const [lento, setLento] = useState(false)
  useEffect(() => { const t = setTimeout(() => setLento(true), 4000); return () => clearTimeout(t) }, [])
  if (erro) return <div className="erro" role="alert">{erro}</div>
  if (!itens) return (
    <div className="tabela carregando" aria-busy="true">
      {[70, 90, 60, 80].map((w, i) => <div key={i} className="esqueleto" style={{ width: w + '%' }} />)}
      {lento && <p className="aviso-lento">Ligando o banco de dados. No primeiro acesso do dia isso leva até um minuto.</p>}
    </div>
  )
  if (!itens.length) return <div className="tabela"><div className="vazio">{vazio}</div></div>
  return <>{children}</>
}

export function Segmentos<T extends string>({ opcoes, valor, set, rotulo }: {
  opcoes: Record<T, string>; valor: T; set: (v: T) => void; rotulo: string
}) {
  return (
    <div className="segmentos" role="group" aria-label={rotulo}>
      {(Object.keys(opcoes) as T[]).map(k => (
        <button key={k} type="button" aria-pressed={valor === k} onClick={() => set(k)}>{opcoes[k]}</button>
      ))}
    </div>
  )
}

export function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

/** Converte null em '' para os campos do formulário. */
export function paraForm<T extends object>(o: T): { [K in keyof T]: any } {
  const r: any = {}
  for (const [k, v] of Object.entries(o)) r[k] = v ?? ''
  return r
}
