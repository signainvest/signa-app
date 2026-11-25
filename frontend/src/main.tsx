import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { api, ErroApi } from './api'
import { Contatos, Deals, Oportunidades } from './paginas'
import './styles.css'

const ABAS = [
  { id: 'oportunidades', rotulo: 'Oportunidades', C: Oportunidades },
  { id: 'deals', rotulo: 'Deals fechados', C: Deals },
  { id: 'contatos', rotulo: 'Contatos', C: Contatos },
] as const

function abaAtual() {
  const h = window.location.hash.replace('#', '')
  return ABAS.find(a => a.id === h)?.id ?? 'oportunidades'
}

function App() {
  const [email, setEmail] = useState<string | null>(null)
  const [bloqueio, setBloqueio] = useState<string | null>(null)
  const [aba, setAba] = useState(abaAtual)

  useEffect(() => {
    api.eu().then(r => setEmail(r.email)).catch(e => setBloqueio(e instanceof ErroApi ? e.message : 'Não foi possível entrar.'))
    const h = () => setAba(abaAtual())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  if (bloqueio) return (
    <main className="centro"><div>
      <img src="/brand/signa-invest-horizontal-grafite.svg" alt="Signa Invest" width="200" height="67" />
      <h1>Acesso restrito</h1>
      <p className="sub">{bloqueio}</p>
      <p><a className="botao" href="/logout">Sair e entrar com outra conta</a></p>
    </div></main>
  )
  if (!email) return <main className="centro"><p className="fraco">Carregando…</p></main>

  const Atual = ABAS.find(a => a.id === aba)!.C
  return (
    <>
      <header className="topo">
        <div className="topo-in">
          <a href="#oportunidades" aria-label="Signa Invest - início">
            <img src="/brand/signa-invest-horizontal-marfim.svg" alt="Signa Invest" width="132" height="44" />
          </a>
          <nav className="abas" aria-label="Seções">
            {ABAS.map(a => (
              <button key={a.id} className="aba" aria-current={a.id === aba ? 'page' : undefined}
                      onClick={() => { window.location.hash = a.id }}>{a.rotulo}</button>
            ))}
          </nav>
          <div className="usuario"><span>{email}</span><a href="/logout">Sair</a></div>
        </div>
      </header>
      <main className="pagina"><Atual key={aba} /></main>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
