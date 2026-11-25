import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { api, ErroApi } from './api'
import { iniciais } from './comum'
import { Icone } from './icones'
import { Contatos, Oportunidades } from './paginas'
import './styles.css'

// "Deals fechados" fica fora do menu por enquanto (a tela e os dados continuam em paginas.tsx > Deals)
const ABAS = [
  { id: 'oportunidades', rotulo: 'Oportunidades', C: Oportunidades },
  { id: 'contatos', rotulo: 'Contatos', C: Contatos },
] as const

function abaAtual() {
  const h = window.location.hash.replace('#', '')
  return ABAS.find(a => a.id === h)?.id ?? 'oportunidades'
}
function lerRecolhido() {
  try { return localStorage.getItem('signa.menu') === 'recolhido' } catch { return false }
}
function nomeDe(email: string) {
  const local = email.split('@')[0].replace(/[._-]+/g, ' ')
  return local.replace(/\b\w/g, c => c.toUpperCase())
}

function Selo({ tamanho = 44 }: { tamanho?: number }) {
  return <span className="selo"><img src="/brand/sinete-256.webp" alt="" width={tamanho} height={tamanho} /></span>
}

function App() {
  const [email, setEmail] = useState<string | null>(null)
  const [bloqueio, setBloqueio] = useState<string | null>(null)
  const [aba, setAba] = useState(abaAtual)
  const [recolhido, setRecolhido] = useState(lerRecolhido)

  useEffect(() => {
    api.eu().then(r => setEmail(r.email)).catch(e => setBloqueio(e instanceof ErroApi ? e.message : 'Não foi possível entrar.'))
    const h = () => setAba(abaAtual())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  function alternar() {
    setRecolhido(r => {
      try { localStorage.setItem('signa.menu', r ? 'aberto' : 'recolhido') } catch { /* sem armazenamento */ }
      return !r
    })
  }

  if (bloqueio) return (
    <div className="app" style={{ display: 'block' }}><main className="centro"><div>
      <Selo tamanho={88} />
      <h1>Acesso restrito</h1>
      <p>{bloqueio}</p>
      <a className="botao" href="/logout">Entrar com outra conta</a>
    </div></main></div>
  )
  if (!email) return <div className="app" style={{ display: 'block' }}><main className="centro"><Selo tamanho={88} /></main></div>

  const Atual = ABAS.find(a => a.id === aba)!.C
  const nome = nomeDe(email)

  return (
    <div className={'app' + (recolhido ? ' recolhida' : '')}>
      <aside className="nav">
        <div className="nav-vidro">
          <div className="nav-topo">
            <a className="marca" href="#oportunidades" aria-label="Signa Invest - início">
              <Selo />
              <img className="wordmark" src="/brand/signa-invest-wordmark-marfim.svg" alt="" width="79" height="30" />
            </a>
            <button className="alternar" onClick={alternar} aria-expanded={!recolhido}
                    aria-label={recolhido ? 'Abrir menu' : 'Recolher menu'} title={recolhido ? 'Abrir menu' : 'Recolher menu'}>
              {Icone.painel}
            </button>
          </div>

          <nav className="menu" aria-label="Seções">
            {ABAS.map(a => (
              <a key={a.id} href={'#' + a.id} className="item" aria-current={a.id === aba ? 'page' : undefined}
                 title={recolhido ? a.rotulo : undefined} aria-label={a.rotulo}>
                {Icone[a.id]}<span className="texto">{a.rotulo}</span>
              </a>
            ))}
          </nav>

          <div className="nav-pe">
            <div className="cartao-usuario">
              <span className="avatar" aria-hidden="true">{iniciais(nome)}</span>
              <div className="quem"><strong>{nome}</strong><span title={email}>{email}</span></div>
              <a className="sair" href="/logout" aria-label="Sair" title="Sair">{Icone.sair}</a>
            </div>
          </div>
        </div>
      </aside>

      <main className="palco">
        <div className="folha" key={aba}><div className="folha-in"><Atual /></div></div>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
