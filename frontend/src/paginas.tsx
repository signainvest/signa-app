import { useMemo, useState } from 'react'
import {
  CLASSES_ATIVO, Contato, Deal, JURISDICOES, Jurisdicao, Oportunidade, STATUS, Status, TIPOS, TipoContato,
  dataBr, dinheiro, pct, sem,
} from './api'
import { Cabeca, Estado, Ferramentas, Painel, Segmentos, paraForm, useLista } from './comum'
import { Icone } from './icones'
import { HistoricoContato } from './anotacoes'
import { useEffect } from 'react'

function buscar<T>(itens: T[], busca: string, campos: (i: T) => (string | null | undefined)[]) {
  const q = sem(busca.trim())
  if (!q) return itens
  return itens.filter(i => campos(i).some(c => c && sem(c).includes(q)))
}

const simbolo = (j: Jurisdicao) => (j === 'offshore' ? 'US$' : 'R$')

/** Campo de dinheiro com separador de milhar; guarda só os dígitos (e decimais) no formulário. */
function CampoValor({ valor, set, moeda }: { valor: string | number; set: (v: string) => void; moeda: string }) {
  const bruto = valor === '' || valor == null ? '' : String(valor)
  const [int, dec] = bruto.split('.')
  const mostra = bruto === '' ? '' : Number(int).toLocaleString('pt-BR') + (dec ? ',' + dec.slice(0, 2) : '')
  return (
    <div className="prefixo"><span>{moeda}</span>
      <input className="entrada" inputMode="decimal" value={mostra} placeholder="0"
             onChange={e => {
               const t = e.target.value.replace(/[^\d,]/g, '')
               const [i, d] = t.split(',')
               set(i === '' && d === undefined ? '' : (i || '0') + (d !== undefined ? '.' + d.slice(0, 2) : ''))
             }} />
    </div>
  )
}

function Pilula({ classe, children }: { classe: string; children: React.ReactNode }) {
  return <span className={'pilula t-' + classe}><span className="ponto" />{children}</span>
}

function Rodape({ n, total, nome }: { n: number; total: number; nome: [string, string] }) {
  return <div className="rodape-tabela">{n === total ? `${total} ${total === 1 ? nome[0] : nome[1]}` : `${n} de ${total} ${nome[1]}`}</div>
}

// ======================================================= Oportunidades

const OP_VAZIA = {
  nome: '', originador_id: '', classe_ativo: '', jurisdicao: 'onshore' as Jurisdicao,
  total_captacao: '', ticket_minimo: '', status: 'em_analise' as Status, observacoes: '',
}

export function Oportunidades() {
  const { itens, erro, recarregar } = useLista<Oportunidade>('oportunidades')
  const contatos = useLista<Contato>('contatos')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | Status>('todas')
  const [aberto, setAberto] = useState<{ id?: number; dados: typeof OP_VAZIA } | null>(null)

  const todos = itens || []
  const conta = (s: Status) => todos.filter(o => o.status === s).length
  const lista = itens && buscar(filtro === 'todas' ? itens : itens.filter(o => o.status === filtro), busca,
    o => [o.nome, o.originador_nome, o.originador_empresa, o.classe_ativo, STATUS[o.status], JURISDICOES[o.jurisdicao]])

  const resumo = useMemo(() => {
    const capt = todos.filter(o => o.status === 'em_captacao')
    const soma = (j: Jurisdicao) => capt.filter(o => o.jurisdicao === j).reduce((s, o) => s + (o.total_captacao || 0), 0)
    return { analise: todos.filter(o => o.status === 'em_analise').length, captacao: capt.length, brl: soma('onshore'), usd: soma('offshore') }
  }, [itens])

  const originadores = (contatos.itens || []).filter(c => c.tipo !== 'investidor')
  const abrir = (o?: Oportunidade) => setAberto(o ? { id: o.id, dados: paraForm(o) as any } : { dados: OP_VAZIA })

  return (
    <>
      <Cabeca titulo="Oportunidades" 
              acao={<button className="botao" onClick={() => abrir()}>{Icone.mais}Nova oportunidade</button>} />

      {todos.length > 0 && (
        <div className="faixa">
          <div><div className="rot"><span className="ponto" style={{ background: 'var(--muted)' }} />Em análise</div><div className="val">{resumo.analise}</div></div>
          <div><div className="rot"><span className="ponto" style={{ background: 'var(--graphite)' }} />Em captação</div><div className="val">{resumo.captacao}</div></div>
          <div><div className="rot">Volume em captação, onshore</div><div className="val">{dinheiro(resumo.brl)}</div></div>
          <div><div className="rot">Volume em captação, offshore</div><div className="val">{dinheiro(resumo.usd, 'offshore')}</div></div>
        </div>
      )}

      <Ferramentas
        filtros={[{ id: 'todas' as const, rotulo: 'Todas', n: todos.length },
          ...(Object.keys(STATUS) as Status[]).map(s => ({ id: s, rotulo: STATUS[s], n: conta(s) }))]}
        ativo={filtro} setAtivo={setFiltro} busca={busca} setBusca={setBusca} dica="Buscar" />

      <Estado itens={lista} erro={erro} vazio={
        busca || filtro !== 'todas'
          ? <><h3>Nada encontrado</h3><p>Nenhuma oportunidade com esse filtro ou busca.</p></>
          : <><h3>Nenhuma oportunidade cadastrada</h3><p>Registre a primeira para começar a acompanhar o andamento.</p>
              <button className="botao" onClick={() => abrir()}>{Icone.mais}Nova oportunidade</button></>
      }>
        <div className="tabela">
          <div className="tabela-rolo">
            <table>
              <thead><tr><th>Empresa</th><th>Oportunidade</th><th>Classe</th><th>Jurisdição</th><th className="num">Total da captação</th><th className="num">Ticket mín.</th><th>Status</th></tr></thead>
              <tbody>
                {lista?.map(o => (
                  <tr key={o.id} tabIndex={0} onClick={() => abrir(o)} onKeyDown={e => e.key === 'Enter' && abrir(o)}>
                    <td>{o.originador_empresa || <span className="fraco">—</span>}</td>
                    <td><strong>{o.nome}</strong></td>
                    <td>{o.classe_ativo || <span className="fraco">—</span>}</td>
                    <td>{JURISDICOES[o.jurisdicao]}</td>
                    <td className="num">{dinheiro(o.total_captacao, o.jurisdicao)}</td>
                    <td className="num">{dinheiro(o.ticket_minimo, o.jurisdicao)}</td>
                    <td><Pilula classe={o.status}>{STATUS[o.status]}</Pilula></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Rodape n={lista?.length || 0} total={todos.length} nome={['oportunidade', 'oportunidades']} />
        </div>
      </Estado>

      {aberto && (
        <Painel titulo={aberto.id ? aberto.dados.nome || 'Oportunidade' : 'Nova oportunidade'}
                subtitulo={aberto.id ? 'Editar oportunidade' : 'Preencha o essencial; o resto pode vir depois.'}
                rotuloSalvar={aberto.id ? 'Salvar alterações' : 'Cadastrar oportunidade'}
                recurso="oportunidades" id={aberto.id} inicial={aberto.dados}
                aoFechar={() => setAberto(null)} aoSalvar={() => { setAberto(null); recarregar() }}>
          {(f, set) => <>
            <div className="grupo">
              <label>Nome<input className="entrada" required autoFocus value={f.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: FIP Infraestrutura Sul" /></label>
              <label>Originador
                <select className="entrada" value={f.originador_id} onChange={e => set('originador_id', e.target.value)}>
                  <option value="">Sem originador</option>
                  {originadores.map(c => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` · ${c.empresa}` : ''}</option>)}
                </select>
              </label>
              <label>Status
                <select className="entrada" value={f.status} onChange={e => set('status', e.target.value as Status)}>
                  {(Object.keys(STATUS) as Status[]).map(k => <option key={k} value={k}>{STATUS[k]}</option>)}
                </select>
              </label>
            </div>
            <div className="grupo">
              <p className="grupo-tit">Estrutura</p>
              <Segmentos rotulo="Onshore ou offshore" opcoes={JURISDICOES} valor={f.jurisdicao} set={v => set('jurisdicao', v)} />
              <label>Classe de ativo
                <select className="entrada" value={f.classe_ativo} onChange={e => set('classe_ativo', e.target.value)}>
                  <option value="">Selecione</option>
                  {[...new Set([...CLASSES_ATIVO, ...(f.classe_ativo ? [f.classe_ativo] : [])])].map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              <div className="duas">
                <label>Total da captação
                  <CampoValor moeda={simbolo(f.jurisdicao)} valor={f.total_captacao} set={v => set('total_captacao', v)} />
                </label>
                <label>Ticket mínimo
                  <CampoValor moeda={simbolo(f.jurisdicao)} valor={f.ticket_minimo} set={v => set('ticket_minimo', v)} />
                </label>
              </div>
            </div>
            <div className="grupo">
              <label>Observações<textarea className="entrada" value={f.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Tese, prazos, próximos passos…" /></label>
            </div>
          </>}
        </Painel>
      )}
    </>
  )
}

// ======================================================= Contatos

const CT_VAZIO = { nome: '', empresa: '', email: '', telefone: '', tipo: 'investidor' as TipoContato, observacoes: '' }

export function Contatos({ abrirId }: { abrirId?: number }) {
  const { itens, erro, recarregar } = useLista<Contato>('contatos')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | TipoContato>('todos')
  const [aberto, setAberto] = useState<{ id?: number; dados: typeof CT_VAZIO } | null>(null)

  const todos = itens || []
  const lista = itens && buscar(filtro === 'todos' ? itens : itens.filter(c => c.tipo === filtro), busca,
    c => [c.nome, c.empresa, c.email, c.telefone])
  const abrir = (c?: Contato) => setAberto(c ? { id: c.id, dados: paraForm(c) as any } : { dados: CT_VAZIO })
  // vindo do Radar: abre o contato pedido
  useEffect(() => {
    if (abrirId && itens) { const c = itens.find(x => x.id === abrirId); if (c) abrir(c) }
  }, [abrirId, itens])
  const n = (t: TipoContato) => todos.filter(c => c.tipo === t).length

  return (
    <>
      <Cabeca titulo="Contatos" 
              acao={<button className="botao" onClick={() => abrir()}>{Icone.mais}Novo contato</button>} />

      <Ferramentas
        filtros={[{ id: 'todos' as const, rotulo: 'Todos', n: todos.length },
          { id: 'investidor' as const, rotulo: 'Investidores', n: n('investidor') },
          { id: 'originador' as const, rotulo: 'Originadores', n: n('originador') },
          { id: 'outro' as const, rotulo: 'Outros', n: n('outro') }]}
        ativo={filtro} setAtivo={setFiltro} busca={busca} setBusca={setBusca} dica="Buscar" />

      <Estado itens={lista} erro={erro} vazio={
        busca || filtro !== 'todos'
          ? <><h3>Nada encontrado</h3><p>Nenhum contato com esse filtro ou busca.</p></>
          : <><h3>Nenhum contato cadastrado</h3><p>Comece pelos investidores e originadores com quem a Signa já conversa.</p>
              <button className="botao" onClick={() => abrir()}>{Icone.mais}Novo contato</button></>
      }>
        <div className="tabela">
          <div className="tabela-rolo">
            <table>
              <thead><tr><th>Tipo</th><th>Empresa</th><th>Nome</th><th>E-mail</th><th>Telefone</th></tr></thead>
              <tbody>
                {lista?.map(c => (
                  <tr key={c.id} tabIndex={0} onClick={() => abrir(c)} onKeyDown={e => e.key === 'Enter' && abrir(c)}>
                    <td><Pilula classe={c.tipo}>{TIPOS[c.tipo]}</Pilula></td>
                    <td>{c.empresa || <span className="fraco">—</span>}</td>
                    <td><strong>{c.nome}</strong></td>
                    <td>{c.email ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ color: 'inherit' }}>{c.email}</a> : <span className="fraco">—</span>}</td>
                    <td>{c.telefone || <span className="fraco">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Rodape n={lista?.length || 0} total={todos.length} nome={['contato', 'contatos']} />
        </div>
      </Estado>

      {aberto && (
        <Painel titulo={aberto.id ? aberto.dados.nome || 'Contato' : 'Novo contato'}
                subtitulo={aberto.id ? 'Editar contato' : undefined}
                rotuloSalvar={aberto.id ? 'Salvar alterações' : 'Cadastrar contato'}
                recurso="contatos" id={aberto.id} inicial={aberto.dados}
                aoFechar={() => { setAberto(null); if (abrirId) window.location.hash = 'contatos' }} aoSalvar={() => { setAberto(null); recarregar() }} largo>
          {(f, set) => <>
            <div className="grupo">
              <Segmentos rotulo="Tipo de contato" opcoes={TIPOS} valor={f.tipo} set={v => set('tipo', v)} />
              <label>Nome<input className="entrada" required autoFocus value={f.nome} onChange={e => set('nome', e.target.value)} /></label>
              <label>Empresa<input className="entrada" value={f.empresa} onChange={e => set('empresa', e.target.value)} /></label>
            </div>
            <div className="grupo">
              <div className="duas">
                <label>E-mail<input className="entrada" type="email" value={f.email} onChange={e => set('email', e.target.value)} /></label>
                <label>Telefone<input className="entrada" type="tel" value={f.telefone} onChange={e => set('telefone', e.target.value)} /></label>
              </div>
            </div>
            <div className="grupo">
              <label>Observações<textarea className="entrada" value={f.observacoes} onChange={e => set('observacoes', e.target.value)} /></label>
            </div>
            {aberto.id
              ? <HistoricoContato contatoId={aberto.id} />
              : <p className="fraco" style={{ margin: 0 }}>Depois de cadastrar o contato, você registra aqui o Radar das conversas com ele.</p>}
          </>}
        </Painel>
      )}
    </>
  )
}

// ======================================================= Deals fechados (fora do menu por enquanto)

const DL_VAZIO = { oportunidade_id: '', investidor_id: '', valor: '', data_fechamento: '', comissao_pct: '' }

export function Deals() {
  const { itens, erro, recarregar } = useLista<Deal>('deals')
  const ops = useLista<Oportunidade>('oportunidades')
  const contatos = useLista<Contato>('contatos')
  const [aberto, setAberto] = useState<{ id?: number; dados: typeof DL_VAZIO } | null>(null)
  const investidores = (contatos.itens || []).filter(c => c.tipo !== 'originador')
  const juris = (id: string): Jurisdicao => ops.itens?.find(o => String(o.id) === String(id))?.jurisdicao || 'onshore'

  return (
    <>
      <Cabeca titulo="Deals fechados" sub="Captações concluídas e comissões."
              acao={<button className="botao" onClick={() => setAberto({ dados: { ...DL_VAZIO, data_fechamento: new Date().toISOString().slice(0, 10) } })}>{Icone.mais}Novo deal</button>} />
      <div style={{ height: 26 }} />
      <Estado itens={itens} erro={erro} vazio={<><h3>Nenhum deal fechado</h3><p>Registre o primeiro em “Novo deal”.</p></>}>
        <div className="tabela"><div className="tabela-rolo">
          <table>
            <thead><tr><th>Data</th><th>Oportunidade</th><th>Investidor</th><th className="num">Valor</th><th className="num">Comissão</th></tr></thead>
            <tbody>
              {itens?.map(d => (
                <tr key={d.id} tabIndex={0} onClick={() => setAberto({ id: d.id, dados: paraForm(d) as any })}>
                  <td>{dataBr(d.data_fechamento)}</td><td><strong>{d.oportunidade_nome}</strong></td>
                  <td>{d.investidor_nome || <span className="fraco">—</span>}</td>
                  <td className="num">{dinheiro(d.valor, d.jurisdicao)}</td><td className="num">{pct(d.comissao_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      </Estado>
      {aberto && (
        <Painel titulo={aberto.id ? 'Editar deal' : 'Novo deal'} rotuloSalvar="Salvar" recurso="deals" id={aberto.id}
                inicial={aberto.dados} aoFechar={() => setAberto(null)} aoSalvar={() => { setAberto(null); recarregar() }}>
          {(f, set) => <div className="grupo">
            <label>Oportunidade
              <select className="entrada" required value={f.oportunidade_id} onChange={e => set('oportunidade_id', e.target.value)}>
                <option value="">Selecione</option>
                {(ops.itens || []).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </label>
            <label>Investidor
              <select className="entrada" value={f.investidor_id} onChange={e => set('investidor_id', e.target.value)}>
                <option value="">—</option>
                {investidores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <div className="duas">
              <label>Valor<div className="prefixo"><span>{simbolo(juris(f.oportunidade_id))}</span>
                <input className="entrada" type="number" min="0" step="any" value={f.valor} onChange={e => set('valor', e.target.value)} /></div></label>
              <label>Data<input className="entrada" type="date" value={String(f.data_fechamento).slice(0, 10)} onChange={e => set('data_fechamento', e.target.value)} /></label>
            </div>
            <label>Comissão (%)<input className="entrada" type="number" min="0" max="100" step="any" value={f.comissao_pct} onChange={e => set('comissao_pct', e.target.value)} /></label>
          </div>}
        </Painel>
      )}
    </>
  )
}
