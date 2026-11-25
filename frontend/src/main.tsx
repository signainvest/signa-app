import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { api, ErroApi } from './api'
import { Contatos, Oportunidades } from './paginas'
import './styles.css'

// "Deals fechados" fica fora do menu por enquanto (a tela e os dados continuam no código: paginas.tsx > Deals)
const ICONE = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

const Icones = {
  oportunidades: <svg {...ICONE}><rect x="3" y="7" width="18" height="13" rx="1.5" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" /><path d="M3 12.5h18" /></svg>,
  contatos: <svg {...ICONE}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" /><path d="M18.5 14.8c1.7.7 2.7 2.4 3 5.2" /></svg>,
  sair: <svg {...ICONE}><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></svg>,
  recolher: <svg {...ICONE}><path d="M15 6l-6 6 6 6" /></svg>,
  abrir: <svg {...ICONE}><path d="M9 6l6 6-6 6" /></svg>,
}

const ABAS = [
  { id: 'oportunidades', rotulo: 'Oportunidades', C: Oportunidades },
  { id: 'contatos', rotulo: 'Contatos', C: Contatos },
] as const

function lerRecolhido() {
  try { return localStorage.getItem('signa.menu') === 'recolhido' } catch { return false }
}

function abaAtual() {
  const h = window.location.hash.replace('#', '')
  return ABAS.find(a => a.id === h)?.id ?? 'oportunidades'
}

function App() {
  const [email, setEmail] = useState<string | null>(null)
  const [bloqueio, setBloqueio] = useState<string | null>(null)
  const [aba, setAba] = useState(abaAtual)
  const [recolhido, setRecolhido] = useState(lerRecolhido)

  function alternar() {
    setRecolhido(r => {
      try { localStorage.setItem('signa.menu', r ? 'aberto' : 'recolhido') } catch { /* sem armazenamento */ }
      return !r
    })
  }

  useEffect(() => {
    api.eu().then(r => setEmail(r.email)).catch(e => setBloqueio(e instanceof ErroApi ? e.message : 'Não foi possível entrar.'))
    const h = () => setAba(abaAtual())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  if (bloqueio) return (
    <main className="centro"><div>
      <img src="/brand/sinete-256.webp" alt="Signa Invest" width="120" height="120" />
      <h1>Acesso restrito</h1>
      <p className="sub">{bloqueio}</p>
      <p><a className="botao" href="/logout">Sair e entrar com outra conta</a></p>
    </div></main>
  )
  if (!email) return <main className="centro"><p className="fraco">Carregando…</p></main>

  const Atual = ABAS.find(a => a.id === aba)!.C
  return (
    <div className={'moldura' + (recolhido ? ' recolhida' : '')}>
      <aside className="lateral">
        <a className="marca" href="#oportunidades" aria-label="Signa Invest - início">
          <img src="/brand/sinete-256.webp" alt="Signa Invest" width="88" height="88" />
        </a>
        <nav className="menu" aria-label="Seções">
          {ABAS.map(a => (
            <button key={a.id} className="item" aria-current={a.id === aba ? 'page' : undefined}
                    title={recolhido ? a.rotulo : undefined} aria-label={a.rotulo}
                    onClick={() => { window.location.hash = a.id }}>
              {Icones[a.id]}<span className="texto">{a.rotulo}</span>
            </button>
          ))}
        </nav>
        <div className="usuario">
          <span className="texto email" title={email}>{email}</span>
          <a className="item" href="/logout" title={recolhido ? 'Sair' : undefined} aria-label="Sair">
            {Icones.sair}<span className="texto">Sair</span>
          </a>
          <button className="item alternar" onClick={alternar} aria-expanded={!recolhido}
                  title={recolhido ? 'Abrir menu' : 'Recolher menu'} aria-label={recolhido ? 'Abrir menu' : 'Recolher menu'}>
            {recolhido ? Icones.abrir : Icones.recolher}<span className="texto">Recolher</span>
          </button>
        </div>
      </aside>
      <main className="pagina"><Atual key={aba} /></main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
