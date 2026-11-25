import { ReactNode, useCallback, useEffect, useState } from 'react'
import { api, ErroApi } from './api'

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
  recurso: string
  id?: number
  inicial: F
  aoFechar: () => void
  aoSalvar: () => void
  children: (f: F, set: <K extends keyof F>(k: K, v: F[K]) => void) => ReactNode
}

/** Painel lateral com formulário: criar, editar e excluir. */
export function Painel<F extends object>({ titulo, recurso, id, inicial, aoFechar, aoSalvar, children }: PainelProps<F>) {
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
    catch (x) { setErro(x instanceof ErroApi ? x.message : 'Não foi possível salvar.') }
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
        <h2>{titulo}</h2>
        {erro && <div className="erro" role="alert">{erro}</div>}
        <div className="campos">{children(form, set)}</div>
        <div className="rodape-painel">
          {id ? <button type="button" className="botao perigo" onClick={excluir} disabled={ocupado}>Excluir</button> : <span />}
          <div>
            <button type="button" className="botao contorno" onClick={aoFechar} disabled={ocupado}>Cancelar</button>
            <button type="submit" className="botao" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}

export function Cabeca({ titulo, sub, busca, setBusca, novo, rotuloNovo }: {
  titulo: string; sub: string; busca: string; setBusca: (s: string) => void; novo: () => void; rotuloNovo: string
}) {
  return (
    <div className="cabeca">
      <div>
        <h1 className="titulo">{titulo}</h1>
        <p className="sub">{sub}</p>
      </div>
      <div className="acoes">
        <input className="busca" type="search" placeholder="Buscar…" aria-label="Buscar"
               value={busca} onChange={e => setBusca(e.target.value)} />
        <button className="botao" onClick={novo}>{rotuloNovo}</button>
      </div>
    </div>
  )
}

export function Estado({ itens, erro, vazio, children }: {
  itens: unknown[] | null; erro: string | null; vazio: ReactNode; children: ReactNode
}) {
  if (erro) return <div className="erro" role="alert">{erro}</div>
  if (!itens) return <div className="aviso">Carregando… (o primeiro acesso do dia pode levar até um minuto)</div>
  if (!itens.length) return <div className="tabela-wrap"><div className="vazio">{vazio}</div></div>
  return <>{children}</>
}

/** Converte null em '' para os campos do formulário. */
export function paraForm<T extends object>(o: T): { [K in keyof T]: any } {
  const r: any = {}
  for (const [k, v] of Object.entries(o)) r[k] = v ?? ''
  return r
}
