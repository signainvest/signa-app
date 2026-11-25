import { useMemo } from 'react'
import { Anotacao, Contato, dinheiro, JURISDICOES, Oportunidade, STATUS } from './api'
import { useAnotacoes } from './anotacoes'
import { Cabeca, useLista } from './comum'

/*
  Regra do Match (v1)
  - O interesse atual de um investidor é a anotação MAIS RECENTE dele que tem etiqueta de classe de ativo.
  - Combina com uma oportunidade aberta (em análise ou em captação) quando:
      1) a classe de ativo da oportunidade está entre as etiquetas do interesse; e
      2) a jurisdição não conflita: o interesse diz "Ambos", não diz nada, ou diz a mesma da oportunidade.
  - Ticket fica de fora de propósito (é dinâmico).
*/

export const ABERTA = (o: Oportunidade) => o.status === 'em_analise' || o.status === 'em_captacao'

export function interessesAtuais(notas: Anotacao[]) {
  const m = new Map<number, Anotacao>()
  for (const n of notas) {                      // já vêm da mais nova para a mais antiga
    if (n.contato_tipo !== 'investidor' || !n.classes.length) continue
    if (!m.has(n.contato_id)) m.set(n.contato_id, n)
  }
  return m
}

export type Afinidade = 'exata' | 'classe'
export function combina(o: Oportunidade, n: Anotacao): Afinidade | null {
  if (!o.classe_ativo || !n.classes.includes(o.classe_ativo)) return null
  if (!n.jurisdicao || n.jurisdicao === 'ambos') return 'classe'
  return n.jurisdicao === o.jurisdicao ? 'exata' : null
}

export interface Par { op: Oportunidade; nota: Anotacao; afinidade: Afinidade }

export function useMatch() {
  const notas = useAnotacoes('')
  const ops = useLista<Oportunidade>('oportunidades')
  const pronto = notas.itens && ops.itens
  const pares = useMemo(() => {
    if (!pronto) return null
    const atuais = [...interessesAtuais(notas.itens!).values()]
    const r: Par[] = []
    for (const op of ops.itens!.filter(ABERTA))
      for (const nota of atuais) {
        const a = combina(op, nota)
        if (a) r.push({ op, nota, afinidade: a })
      }
    return r.sort((x, y) => (x.afinidade === y.afinidade ? y.nota.data.localeCompare(x.nota.data) : x.afinidade === 'exata' ? -1 : 1))
  }, [notas.itens, ops.itens])
  return { pares, ops: ops.itens, erro: notas.erro || ops.erro }
}

function dataCurta(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: a === new Date().getFullYear() ? undefined : 'numeric' })
    .format(new Date(a, m - 1, d)).replace('.', '')
}

function Motivo({ par }: { par: Par }) {
  return (
    <span className="motivo">
      {par.op.classe_ativo}
      {par.afinidade === 'exata' ? ` e ${JURISDICOES[par.op.jurisdicao]}` : par.nota.jurisdicao === 'ambos' ? ', aceita onshore e offshore' : ''}
    </span>
  )
}

/** Investidores que combinam com uma oportunidade (usado na tela Match e dentro da oportunidade). */
export function InvestidoresDaOportunidade({ pares, aoAbrirContato }: { pares: Par[]; aoAbrirContato: (id: number) => void }) {
  if (!pares.length) return <p className="fraco" style={{ margin: 0 }}>Nenhum investidor com interesse registrado nesta classe de ativo.</p>
  return (
    <ul className="matches">
      {pares.map(p => (
        <li key={p.nota.id}>
          <button type="button" className="match" onClick={() => aoAbrirContato(p.nota.contato_id)}>
            <span className="match-topo">
              <strong>{p.nota.contato_nome}</strong>
              {p.nota.contato_empresa && <span className="fraco">{p.nota.contato_empresa}</span>}
              <span className={'afinidade a-' + p.afinidade}>{p.afinidade === 'exata' ? 'Classe e jurisdição' : 'Classe'}</span>
            </span>
            <span className="match-texto">{p.nota.texto}</span>
            <span className="match-meta">Interesse registrado em {dataCurta(p.nota.data)}; combina em <Motivo par={p} /></span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Oportunidades abertas que combinam com um investidor (usado dentro do contato). */
export function OportunidadesDoInvestidor({ contatoId }: { contatoId: number }) {
  const { pares } = useMatch()
  if (!pares) return null
  const meus = pares.filter(p => p.nota.contato_id === contatoId)
  return (
    <section className="grupo" aria-label="Match">
      <p className="grupo-tit">Match: oportunidades abertas que combinam com o interesse atual</p>
      {meus.length ? (
        <ul className="matches">
          {meus.map(p => (
            <li key={p.op.id}>
              <a className="match" href="#oportunidades">
                <span className="match-topo">
                  <strong>{p.op.nome}</strong>
                  {p.op.originador_empresa && <span className="fraco">{p.op.originador_empresa}</span>}
                  <span className={'afinidade a-' + p.afinidade}>{p.afinidade === 'exata' ? 'Classe e jurisdição' : 'Classe'}</span>
                </span>
                <span className="match-meta">{STATUS[p.op.status]}, {p.op.classe_ativo}, {JURISDICOES[p.op.jurisdicao]}
                  {p.op.ticket_minimo != null && `, ticket mín. ${dinheiro(p.op.ticket_minimo, p.op.jurisdicao)}`}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="fraco" style={{ margin: 0 }}>Nenhuma oportunidade aberta combina com o interesse mais recente deste investidor.</p>}
    </section>
  )
}

// ------------------------------------------------------------ página Match

export function Match({ aoAbrirContato }: { aoAbrirContato: (id: number) => void }) {
  const { pares, ops, erro } = useMatch()
  const contatos = useLista<Contato>('contatos')

  const abertas = (ops || []).filter(ABERTA)
  const semClasse = abertas.filter(o => !o.classe_ativo)
  const porOp = abertas.filter(o => o.classe_ativo)
    .map(op => ({ op, pares: (pares || []).filter(p => p.op.id === op.id) }))
    .sort((a, b) => b.pares.length - a.pares.length)
  const comMatch = porOp.filter(x => x.pares.length)
  const semMatch = porOp.filter(x => !x.pares.length)
  const investidoresComInteresse = new Set((pares || []).map(p => p.nota.contato_id)).size
  const investidores = (contatos.itens || []).filter(c => c.tipo === 'investidor').length

  return (
    <>
      <Cabeca titulo="Match" acao={null} />
      {erro && <div className="erro">{erro}</div>}
      {!pares && !erro && <div className="tabela carregando">{[80, 60, 90].map((w, i) => <div key={i} className="esqueleto" style={{ width: w + '%' }} />)}</div>}

      {pares && (
        <>
          <div className="faixa">
            <div><div className="rot">Oportunidades abertas</div><div className="val">{abertas.length}</div></div>
            <div><div className="rot">Com investidor compatível</div><div className="val">{comMatch.length}</div></div>
            <div><div className="rot">Combinações</div><div className="val">{pares.length}</div></div>
            <div><div className="rot">Investidores em algum match</div><div className="val">{investidoresComInteresse}<small>de {investidores}</small></div></div>
          </div>

          {comMatch.length === 0 && (
            <div className="tabela" style={{ marginTop: 26 }}><div className="vazio">
              <h3>Nenhuma combinação ainda</h3>
              <p>O Match cruza a classe de ativo das oportunidades abertas com as etiquetas do interesse mais recente de cada investidor no Radar.</p>
            </div></div>
          )}

          {comMatch.map(({ op, pares }) => (
            <article key={op.id} className="cartao-match">
              <header className="cm-topo">
                <div>
                  {op.originador_empresa && <p className="cm-empresa">{op.originador_empresa}</p>}
                  <h2 className="cm-nome">{op.nome}</h2>
                  <p className="cm-meta">
                    <span className={'pilula t-' + op.status}><span className="ponto" />{STATUS[op.status]}</span>
                    <span>{op.classe_ativo}</span><span>{JURISDICOES[op.jurisdicao]}</span>
                    {op.total_captacao != null && <span>Captação {dinheiro(op.total_captacao, op.jurisdicao)}</span>}
                    {op.ticket_minimo != null && <span>Ticket mín. {dinheiro(op.ticket_minimo, op.jurisdicao)}</span>}
                  </p>
                </div>
                <div className="cm-conta"><strong>{pares.length}</strong><span>{pares.length === 1 ? 'investidor' : 'investidores'}</span></div>
              </header>
              <InvestidoresDaOportunidade pares={pares} aoAbrirContato={aoAbrirContato} />
            </article>
          ))}

          {(semMatch.length > 0 || semClasse.length > 0) && (
            <details className="sem-match">
              <summary>{semMatch.length + semClasse.length} oportunidades abertas sem combinação</summary>
              <ul>
                {semMatch.map(({ op }) => <li key={op.id}><strong>{op.nome}</strong> <span className="fraco">{op.classe_ativo}, {JURISDICOES[op.jurisdicao]}</span></li>)}
                {semClasse.map(op => <li key={op.id}><strong>{op.nome}</strong> <span className="fraco">sem classe de ativo; preencha para entrar no Match</span></li>)}
              </ul>
            </details>
          )}
          <p className="nota-regra">Como funciona: entra no Match o investidor cuja anotação mais recente no Radar tem a classe de ativo da oportunidade e a mesma jurisdição (ou “Ambos”, ou nenhuma). Oportunidades encerradas e descartadas ficam de fora.</p>
        </>
      )}
    </>
  )
}

/** Bloco "Match" dentro do painel da oportunidade. */
export function MatchDaOportunidade({ opId }: { opId: number }) {
  const { pares, ops } = useMatch()
  if (!pares || !ops) return null
  const op = ops.find(o => o.id === opId)
  if (!op) return null
  return (
    <section className="grupo" aria-label="Match">
      <p className="grupo-tit">Match: investidores com interesse compatível</p>
      {!ABERTA(op) ? <p className="fraco" style={{ margin: 0 }}>Oportunidade {STATUS[op.status].toLowerCase()}: fora do Match.</p>
        : !op.classe_ativo ? <p className="fraco" style={{ margin: 0 }}>Preencha a classe de ativo para ver investidores compatíveis.</p>
        : <InvestidoresDaOportunidade pares={pares.filter(p => p.op.id === opId)} aoAbrirContato={id => { window.location.hash = 'contatos/' + id }} />}
    </section>
  )
}
