import { useMemo, useState } from 'react'
import {
  CLASSES_ATIVO, Contato, Deal, JURISDICOES, Oportunidade, STATUS, TIPOS,
  dataBr, dinheiro, pct, sem,
} from './api'
import { Cabeca, Estado, Painel, paraForm, useLista } from './comum'

function filtrar<T>(itens: T[] | null, busca: string, campos: (i: T) => (string | null | undefined)[]) {
  if (!itens) return null
  const q = sem(busca.trim())
  if (!q) return itens
  return itens.filter(i => campos(i).some(c => c && sem(c).includes(q)))
}

// ======================================================= Oportunidades

const OP_VAZIA = { nome: '', originador_id: '', classe_ativo: '', jurisdicao: 'onshore', total_captacao: '', ticket_minimo: '', status: 'em_analise', observacoes: '' }

export function Oportunidades() {
  const { itens, erro, recarregar } = useLista<Oportunidade>('oportunidades')
  const contatos = useLista<Contato>('contatos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<{ id?: number; dados: typeof OP_VAZIA } | null>(null)
  const lista = filtrar(itens, busca, o => [o.nome, o.originador_nome, o.classe_ativo, STATUS[o.status]])

  const resumo = useMemo(() => {
    const ativas = (itens || []).filter(o => o.status === 'em_analise' || o.status === 'em_captacao')
    return {
      analise: ativas.filter(o => o.status === 'em_analise').length,
      captacao: ativas.filter(o => o.status === 'em_captacao').length,
      total: (itens || []).length,
    }
  }, [itens])

  const originadores = (contatos.itens || []).filter(c => c.tipo !== 'investidor')

  return (
    <>
      <Cabeca titulo="Oportunidades" sub="Investimentos apresentados à Signa e seu andamento."
              busca={busca} setBusca={setBusca} rotuloNovo="Nova oportunidade"
              novo={() => setAberto({ dados: OP_VAZIA })} />
      {itens && itens.length > 0 && (
        <div className="resumo">
          <div className="cartao"><div className="rotulo">Em análise</div><div className="numero">{resumo.analise}</div></div>
          <div className="cartao"><div className="rotulo">Em captação</div><div className="numero">{resumo.captacao}</div></div>
          <div className="cartao"><div className="rotulo">Total cadastrado</div><div className="numero">{resumo.total}</div></div>
        </div>
      )}
      <Estado itens={lista} erro={erro} vazio={<><strong>Nenhuma oportunidade ainda</strong>Cadastre a primeira em “Nova oportunidade”.</>}>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Oportunidade</th><th>Originador</th><th>Classe</th><th>Jurisdição</th><th className="num">Total da captação</th><th className="num">Ticket mín.</th><th>Status</th></tr></thead>
            <tbody>
              {lista?.map(o => (
                <tr key={o.id} tabIndex={0} onClick={() => setAberto({ id: o.id, dados: paraForm(o) as any })}
                    onKeyDown={e => e.key === 'Enter' && setAberto({ id: o.id, dados: paraForm(o) as any })}>
                  <td><strong>{o.nome}</strong></td>
                  <td>{o.originador_nome || <span className="fraco">—</span>}</td>
                  <td>{o.classe_ativo || <span className="fraco">—</span>}</td>
                  <td>{JURISDICOES[o.jurisdicao]}</td>
                  <td className="num">{dinheiro(o.total_captacao, o.jurisdicao)}</td>
                  <td className="num">{dinheiro(o.ticket_minimo, o.jurisdicao)}</td>
                  <td><span className={'selo' + (o.status === 'em_captacao' ? ' cheio' : o.status === 'descartada' ? ' apagado' : '')}>{STATUS[o.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Estado>
      {aberto && (
        <Painel titulo={aberto.id ? 'Editar oportunidade' : 'Nova oportunidade'} recurso="oportunidades"
                id={aberto.id} inicial={aberto.dados} aoFechar={() => setAberto(null)}
                aoSalvar={() => { setAberto(null); recarregar() }}>
          {(f, set) => <>
            <label>Nome<input className="entrada" required autoFocus value={f.nome} onChange={e => set('nome', e.target.value)} /></label>
            <label>Originador <span className="opc">(contato)</span>
              <select className="entrada" value={f.originador_id} onChange={e => set('originador_id', e.target.value)}>
                <option value="">—</option>
                {originadores.map(c => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` · ${c.empresa}` : ''}</option>)}
              </select>
            </label>
            <div className="duas">
              <label>Classe de ativo
                <select className="entrada" value={f.classe_ativo} onChange={e => set('classe_ativo', e.target.value)}>
                  <option value="">—</option>
                  {[...new Set([...CLASSES_ATIVO, ...(f.classe_ativo ? [f.classe_ativo] : [])])].map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Onshore / Offshore
                <select className="entrada" value={f.jurisdicao} onChange={e => set('jurisdicao', e.target.value)}>
                  {Object.entries(JURISDICOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
            <div className="duas">
              <label>Total da captação <span className="opc">({f.jurisdicao === 'offshore' ? 'US$' : 'R$'})</span>
                <input className="entrada" type="number" min="0" step="any" inputMode="decimal" value={f.total_captacao} onChange={e => set('total_captacao', e.target.value)} />
              </label>
              <label>Ticket mín. <span className="opc">({f.jurisdicao === 'offshore' ? 'US$' : 'R$'})</span>
                <input className="entrada" type="number" min="0" step="any" inputMode="decimal" value={f.ticket_minimo} onChange={e => set('ticket_minimo', e.target.value)} />
              </label>
            </div>
            <label>Status
                <select className="entrada" value={f.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            <label>Observações<textarea className="entrada" value={f.observacoes} onChange={e => set('observacoes', e.target.value)} /></label>
          </>}
        </Painel>
      )}
    </>
  )
}

// ======================================================= Contatos

const CT_VAZIO = { nome: '', empresa: '', email: '', telefone: '', tipo: 'investidor', observacoes: '' }

export function Contatos() {
  const { itens, erro, recarregar } = useLista<Contato>('contatos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<{ id?: number; dados: typeof CT_VAZIO } | null>(null)
  const lista = filtrar(itens, busca, c => [c.nome, c.empresa, c.email, TIPOS[c.tipo]])

  return (
    <>
      <Cabeca titulo="Contatos" sub="Investidores, originadores e demais relacionamentos."
              busca={busca} setBusca={setBusca} rotuloNovo="Novo contato"
              novo={() => setAberto({ dados: CT_VAZIO })} />
      <Estado itens={lista} erro={erro} vazio={<><strong>Nenhum contato ainda</strong>Cadastre o primeiro em “Novo contato”.</>}>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Empresa</th><th>Nome</th><th>E-mail</th><th>Telefone</th></tr></thead>
            <tbody>
              {lista?.map(c => (
                <tr key={c.id} tabIndex={0} onClick={() => setAberto({ id: c.id, dados: paraForm(c) as any })}
                    onKeyDown={e => e.key === 'Enter' && setAberto({ id: c.id, dados: paraForm(c) as any })}>
                  <td><span className="selo">{TIPOS[c.tipo]}</span></td>
                  <td>{c.empresa || <span className="fraco">—</span>}</td>
                  <td><strong>{c.nome}</strong></td>
                  <td>{c.email || <span className="fraco">—</span>}</td>
                  <td>{c.telefone || <span className="fraco">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Estado>
      {aberto && (
        <Painel titulo={aberto.id ? 'Editar contato' : 'Novo contato'} recurso="contatos" id={aberto.id}
                inicial={aberto.dados} aoFechar={() => setAberto(null)} aoSalvar={() => { setAberto(null); recarregar() }}>
          {(f, set) => <>
            <label>Nome<input className="entrada" required autoFocus value={f.nome} onChange={e => set('nome', e.target.value)} /></label>
            <div className="duas">
              <label>Empresa<input className="entrada" value={f.empresa} onChange={e => set('empresa', e.target.value)} /></label>
              <label>Tipo
                <select className="entrada" value={f.tipo} onChange={e => set('tipo', e.target.value)}>
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
            <div className="duas">
              <label>E-mail<input className="entrada" type="email" value={f.email} onChange={e => set('email', e.target.value)} /></label>
              <label>Telefone<input className="entrada" type="tel" value={f.telefone} onChange={e => set('telefone', e.target.value)} /></label>
            </div>
            <label>Observações<textarea className="entrada" value={f.observacoes} onChange={e => set('observacoes', e.target.value)} /></label>
          </>}
        </Painel>
      )}
    </>
  )
}

// ======================================================= Deals fechados

const DL_VAZIO = { oportunidade_id: '', investidor_id: '', valor: '', data_fechamento: '', comissao_pct: '' }

export function Deals() {
  const { itens, erro, recarregar } = useLista<Deal>('deals')
  const ops = useLista<Oportunidade>('oportunidades')
  const contatos = useLista<Contato>('contatos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<{ id?: number; dados: typeof DL_VAZIO } | null>(null)
  const lista = filtrar(itens, busca, d => [d.oportunidade_nome, d.investidor_nome])

  const totais = useMemo(() => {
    const t = { brl: 0, usd: 0, cBrl: 0, cUsd: 0 }
    for (const d of itens || []) {
      const v = d.valor || 0, c = v * (d.comissao_pct || 0) / 100
      if (d.jurisdicao === 'offshore') { t.usd += v; t.cUsd += c } else { t.brl += v; t.cBrl += c }
    }
    return t
  }, [itens])

  const investidores = (contatos.itens || []).filter(c => c.tipo !== 'originador')
  const juris = (id: string) => ops.itens?.find(o => String(o.id) === String(id))?.jurisdicao || 'onshore'

  return (
    <>
      <Cabeca titulo="Deals fechados" sub="Captações concluídas e comissões."
              busca={busca} setBusca={setBusca} rotuloNovo="Novo deal"
              novo={() => setAberto({ dados: { ...DL_VAZIO, data_fechamento: new Date().toISOString().slice(0, 10) } })} />
      {itens && itens.length > 0 && (
        <div className="resumo">
          <div className="cartao"><div className="rotulo">Captado · onshore</div><div className="numero">{dinheiro(totais.brl)}</div></div>
          <div className="cartao"><div className="rotulo">Captado · offshore</div><div className="numero">{dinheiro(totais.usd, 'offshore')}</div></div>
          <div className="cartao"><div className="rotulo">Comissões</div><div className="numero">{dinheiro(totais.cBrl)}{totais.cUsd ? <span className="fraco"> + {dinheiro(totais.cUsd, 'offshore')}</span> : null}</div></div>
        </div>
      )}
      <Estado itens={lista} erro={erro} vazio={<><strong>Nenhum deal fechado ainda</strong>Registre o primeiro em “Novo deal”.</>}>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Data</th><th>Oportunidade</th><th>Investidor</th><th className="num">Valor</th><th className="num">Comissão</th><th className="num">Comissão (valor)</th></tr></thead>
            <tbody>
              {lista?.map(d => (
                <tr key={d.id} tabIndex={0} onClick={() => setAberto({ id: d.id, dados: paraForm(d) as any })}
                    onKeyDown={e => e.key === 'Enter' && setAberto({ id: d.id, dados: paraForm(d) as any })}>
                  <td>{dataBr(d.data_fechamento)}</td>
                  <td><strong>{d.oportunidade_nome}</strong></td>
                  <td>{d.investidor_nome || <span className="fraco">—</span>}</td>
                  <td className="num">{dinheiro(d.valor, d.jurisdicao)}</td>
                  <td className="num">{pct(d.comissao_pct)}</td>
                  <td className="num">{d.valor != null && d.comissao_pct != null ? dinheiro(d.valor * d.comissao_pct / 100, d.jurisdicao) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Estado>
      {aberto && (
        <Painel titulo={aberto.id ? 'Editar deal' : 'Novo deal'} recurso="deals" id={aberto.id}
                inicial={aberto.dados} aoFechar={() => setAberto(null)} aoSalvar={() => { setAberto(null); recarregar() }}>
          {(f, set) => <>
            <label>Oportunidade
              <select className="entrada" required autoFocus value={f.oportunidade_id} onChange={e => set('oportunidade_id', e.target.value)}>
                <option value="">Selecione…</option>
                {(ops.itens || []).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </label>
            <label>Investidor <span className="opc">(contato)</span>
              <select className="entrada" value={f.investidor_id} onChange={e => set('investidor_id', e.target.value)}>
                <option value="">—</option>
                {investidores.map(c => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` · ${c.empresa}` : ''}</option>)}
              </select>
            </label>
            <div className="duas">
              <label>Valor <span className="opc">({juris(f.oportunidade_id) === 'offshore' ? 'US$' : 'R$'})</span>
                <input className="entrada" type="number" min="0" step="any" inputMode="decimal" value={f.valor} onChange={e => set('valor', e.target.value)} />
              </label>
              <label>Data de fechamento
                <input className="entrada" type="date" value={String(f.data_fechamento).slice(0, 10)} onChange={e => set('data_fechamento', e.target.value)} />
              </label>
            </div>
            <label>Comissão <span className="opc">(% sobre o valor)</span>
              <input className="entrada" type="number" min="0" max="100" step="any" inputMode="decimal" value={f.comissao_pct} onChange={e => set('comissao_pct', e.target.value)} />
            </label>
          </>}
        </Painel>
      )}
    </>
  )
}
