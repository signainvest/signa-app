import { useCallback, useEffect, useMemo, useState } from 'react'
import { Anotacao, api, CLASSES_ATIVO, Contato, ErroApi, JURIS_ANOTACAO, JurisAnotacao, sem, TIPOS, TipoContato } from './api'
import { Cabeca, Ferramentas, nomeDe, useLista } from './comum'
import { Icone } from './icones'

const hojeIso = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function quando(iso: string) {
  const d = iso.slice(0, 10)
  const hoje = hojeIso()
  const ontem = new Date(Date.now() - 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  if (d === hoje) return 'Hoje'
  if (d === ontem) return 'Ontem'
  const [a, m, dia] = d.split('-').map(Number)
  const dt = new Date(a, m - 1, dia)
  const mesmoAno = a === new Date().getFullYear()
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: mesmoAno ? undefined : 'numeric' }).format(dt).replace('.', '')
}

/** Lista de anotações (de um contato ou de todos). */
export function useAnotacoes(filtro: string) {
  const [itens, setItens] = useState<Anotacao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const recarregar = useCallback(async () => {
    try { setErro(null); setItens(await api.listar<Anotacao>('anotacoes' + filtro)) }
    catch (e) { setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar o histórico.') }
  }, [filtro])
  useEffect(() => { recarregar() }, [recarregar])
  return { itens, erro, recarregar }
}

// ------------------------------------------------------------ editor de anotação

interface Rascunho { contato_id: string; data: string; texto: string; classes: string[]; jurisdicao: JurisAnotacao | '' }

export function Editor({ inicial, id, contatos, aoSalvar, aoCancelar }: {
  inicial: Rascunho; id?: number; contatos?: Contato[]; aoSalvar: () => void; aoCancelar?: () => void
}) {
  const [r, setR] = useState<Rascunho>(inicial)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const alternarClasse = (c: string) =>
    setR(x => ({ ...x, classes: x.classes.includes(c) ? x.classes.filter(y => y !== c) : [...x.classes, c] }))

  async function salvar() {
    if (!r.contato_id) { setErro('Escolha o contato.'); return }
    if (!r.texto.trim()) { setErro('Escreva a anotação.'); return }
    setOcupado(true); setErro(null)
    try {
      await api.salvar('anotacoes', { ...r, jurisdicao: r.jurisdicao || null }, id)
      if (!id) setR({ ...inicial, data: hojeIso() })
      aoSalvar()
    } catch (e) { setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar.') }
    finally { setOcupado(false) }
  }
  const semEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); salvar() }
    else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault()
  }

  return (
    <div className="editor-nota" onKeyDown={semEnter}>
      {erro && <div className="erro" role="alert">{erro}</div>}
      <div className={contatos ? 'duas' : ''}>
        {contatos && (
          <label>Contato
            <select className="entrada" value={r.contato_id} onChange={e => setR({ ...r, contato_id: e.target.value })}>
              <option value="">Selecione</option>
              {contatos.map(c => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` (${c.empresa})` : ''}</option>)}
            </select>
          </label>
        )}
        <label className="campo-data">Data da conversa
          <input className="entrada" type="date" value={r.data} max={hojeIso()} onChange={e => setR({ ...r, data: e.target.value })} />
        </label>
      </div>
      <label>O que foi conversado
        <textarea className="entrada" value={r.texto} onChange={e => setR({ ...r, texto: e.target.value })}
                  placeholder="O que busca, o que está trazendo, restrições, prazos…" autoFocus={!!id} />
      </label>
      <div className="etiquetas-campo">
        <span className="rot-campo">Classes de ativo</span>
        <div className="etiquetas" role="group" aria-label="Classes de ativo">
          {CLASSES_ATIVO.map(c => (
            <button key={c} type="button" className="etiqueta" aria-pressed={r.classes.includes(c)} onClick={() => alternarClasse(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="etiquetas-campo">
        <span className="rot-campo">Onshore / Offshore</span>
        <div className="etiquetas" role="group" aria-label="Onshore ou offshore">
          {(Object.keys(JURIS_ANOTACAO) as JurisAnotacao[]).map(k => (
            <button key={k} type="button" className="etiqueta" aria-pressed={r.jurisdicao === k}
                    onClick={() => setR({ ...r, jurisdicao: r.jurisdicao === k ? '' : k })}>{JURIS_ANOTACAO[k]}</button>
          ))}
        </div>
      </div>
      <div className="editor-acoes">
        {aoCancelar && <button type="button" className="botao claro" onClick={aoCancelar} disabled={ocupado}>Cancelar</button>}
        <button type="button" className="botao" onClick={salvar} disabled={ocupado}>{ocupado ? 'Salvando…' : id ? 'Salvar anotação' : 'Registrar anotação'}</button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ cartão de anotação

function Nota({ a, mostrarContato, contatos, aoMudar, aoAbrirContato }: {
  a: Anotacao; mostrarContato: boolean; contatos?: Contato[]; aoMudar: () => void; aoAbrirContato?: (id: number) => void
}) {
  const [editando, setEditando] = useState(false)
  async function excluir() {
    if (!window.confirm('Excluir esta anotação?')) return
    try { await api.remover('anotacoes', a.id); aoMudar() } catch (e) { alert(e instanceof ErroApi ? e.message : 'Não foi possível excluir.') }
  }
  if (editando) return (
    <article className="nota editando">
      <Editor id={a.id} contatos={mostrarContato ? contatos : undefined}
              inicial={{ contato_id: String(a.contato_id), data: a.data.slice(0, 10), texto: a.texto, classes: a.classes, jurisdicao: a.jurisdicao || '' }}
              aoSalvar={() => { setEditando(false); aoMudar() }} aoCancelar={() => setEditando(false)} />
    </article>
  )
  return (
    <article className="nota">
      <header className="nota-topo">
        {mostrarContato ? (
          <div className="nota-quem">
            <button type="button" className="link-contato" onClick={() => aoAbrirContato?.(a.contato_id)}>{a.contato_nome}</button>
            {a.contato_empresa && <span className="fraco">{a.contato_empresa}</span>}
            <span className={'pilula t-' + a.contato_tipo}><span className="ponto" />{TIPOS[a.contato_tipo]}</span>
          </div>
        ) : <span />}
        <div className="nota-meta">
          <time dateTime={a.data.slice(0, 10)}>{quando(a.data)}</time>
          <span>por {nomeDe(a.criado_por)}</span>
        </div>
      </header>
      <p className="nota-texto">{a.texto}</p>
      {(a.classes.length > 0 || a.jurisdicao) && (
        <div className="etiquetas">
          {a.classes.map(c => <span key={c} className="etiqueta fixa">{c}</span>)}
          {a.jurisdicao && <span className="etiqueta fixa contorno">{JURIS_ANOTACAO[a.jurisdicao]}</span>}
        </div>
      )}
      <div className="nota-acoes">
        <button type="button" onClick={() => setEditando(true)}>Editar</button>
        <button type="button" onClick={excluir}>Excluir</button>
      </div>
    </article>
  )
}

// ------------------------------------------------------------ histórico dentro do contato

export function HistoricoContato({ contatoId }: { contatoId: number }) {
  const { itens, erro, recarregar } = useAnotacoes('?contato_id=' + contatoId)
  return (
    <section className="grupo historico" aria-label="Histórico de conversas">
      <p className="grupo-tit">Radar deste contato</p>
      <Editor inicial={{ contato_id: String(contatoId), data: hojeIso(), texto: '', classes: [], jurisdicao: '' }} aoSalvar={recarregar} />
      {erro && <div className="erro">{erro}</div>}
      {itens && itens.length > 0 && (
        <div className="linha-tempo">
          {itens.map((a, i) => (
            <div key={a.id} className="marco">
              {i === 0 && <span className="atual">Mais recente</span>}
              <Nota a={a} mostrarContato={false} aoMudar={recarregar} />
            </div>
          ))}
        </div>
      )}
      {itens && itens.length === 0 && <p className="fraco" style={{ margin: 0 }}>Nenhuma anotação ainda. Registre a primeira conversa acima.</p>}
    </section>
  )
}

// ------------------------------------------------------------ página Radar

export function Radar({ aoAbrirContato }: { aoAbrirContato: (id: number) => void }) {
  const { itens, erro, recarregar } = useAnotacoes('')
  const contatos = useLista<Contato>('contatos')
  const [filtro, setFiltro] = useState<'todos' | TipoContato>('todos')
  const [classe, setClasse] = useState('')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)

  const todos = itens || []
  const lista = useMemo(() => {
    const q = sem(busca.trim())
    return todos.filter(a =>
      (filtro === 'todos' || a.contato_tipo === filtro) &&
      (!classe || a.classes.includes(classe)) &&
      (!q || [a.texto, a.contato_nome, a.contato_empresa].some(t => t && sem(t).includes(q))))
  }, [itens, filtro, classe, busca])

  // agrupa por mês para dar ritmo ao feed
  const grupos = useMemo(() => {
    const m = new Map<string, Anotacao[]>()
    for (const a of lista) {
      const [ano, mes] = a.data.slice(0, 7).split('-').map(Number)
      const k = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(ano, mes - 1, 1))
      m.set(k, [...(m.get(k) || []), a])
    }
    return [...m.entries()]
  }, [lista])

  const n = (t: TipoContato) => todos.filter(a => a.contato_tipo === t).length

  return (
    <>
      <Cabeca titulo="Radar"
              acao={<button className="botao" onClick={() => setNovo(v => !v)} aria-expanded={novo}>{Icone.mais}Nova anotação</button>} />

      {novo && (
        <div className="grupo" style={{ marginTop: 26 }}>
          <Editor contatos={contatos.itens || []}
                  inicial={{ contato_id: '', data: hojeIso(), texto: '', classes: [], jurisdicao: '' }}
                  aoSalvar={() => { setNovo(false); recarregar() }} aoCancelar={() => setNovo(false)} />
        </div>
      )}

      <Ferramentas
        filtros={[{ id: 'todos' as const, rotulo: 'Todos', n: todos.length },
          { id: 'investidor' as const, rotulo: 'Investidores', n: n('investidor') },
          { id: 'originador' as const, rotulo: 'Originadores', n: n('originador') }]}
        ativo={filtro} setAtivo={setFiltro} busca={busca} setBusca={setBusca} dica="Buscar" />
      <div className="filtro-classe">
        <select className="entrada" value={classe} onChange={e => setClasse(e.target.value)} aria-label="Filtrar por classe de ativo">
          <option value="">Todas as classes de ativo</option>
          {CLASSES_ATIVO.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {erro && <div className="erro">{erro}</div>}
      {!itens && !erro && <div className="tabela carregando">{[80, 60, 90].map((w, i) => <div key={i} className="esqueleto" style={{ width: w + '%' }} />)}</div>}
      {itens && lista.length === 0 && (
        <div className="tabela"><div className="vazio">
          {todos.length ? <><h3>Nada encontrado</h3><p>Nenhuma anotação com esse filtro ou busca.</p></>
            : <><h3>O Radar está vazio</h3><p>Registre aqui o que cada investidor busca e o que cada originador está trazendo.</p>
                <button className="botao" onClick={() => setNovo(true)}>{Icone.mais}Nova anotação</button></>}
        </div></div>
      )}
      {grupos.map(([mes, notas]) => (
        <section key={mes} className="mes">
          <h2 className="mes-tit">{mes.charAt(0).toUpperCase() + mes.slice(1)}</h2>
          <div className="feed">
            {notas.map(a => <Nota key={a.id} a={a} mostrarContato contatos={contatos.itens || []} aoMudar={recarregar} aoAbrirContato={aoAbrirContato} />)}
          </div>
        </section>
      ))}
    </>
  )
}
