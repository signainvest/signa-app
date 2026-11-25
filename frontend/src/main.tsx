import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { api, ErroApi } from './api'
import { Contatos, Oportunidades } from './paginas'
import './styles.css'

// "Deals fechados" fica fora do menu por enquanto (a tela e os dados continuam no código: paginas.tsx > Deals)
const ABAS = [
  { id: 'oportunidades', rotulo: 'Oportunidades', C: Oportunidades },
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
      <img src="/brand/sinete-256.webp" alt="Signa Invest" width="120" height="120" />
      <h1>Acesso restrito</h1>
      <p className="sub">{bloqueio}</p>
      <p><a className="botao" href="/logout">Sair e entrar com outra conta</a></p>
    </div></main>
  )
  if (!email) return <main className="centro"><p className="fraco">Carregando…</p></main>

  const Atual = ABAS.find(a => a.id === aba)!.C
  return (
    <div className="moldura">
      <aside className="lateral">
        <a className="marca" href="#oportunidades" aria-label="Signa Invest - início">
          <img src="/brand/sinete-256.webp" alt="Signa Invest" width="88" height="88" />
        </a>
        <nav className="menu" aria-label="Seções">
          {ABAS.map(a => (
            <button key={a.id} className="item" aria-current={a.id === aba ? 'page' : undefined}
                    onClick={() => { window.location.hash = a.id }}>{a.rotulo}</button>
          ))}
        </nav>
        <div className="usuario">
          <span title={email}>{email}</span>
          <a href="/logout">Sair</a>
        </div>
      </aside>
      <main className="pagina"><Atual key={aba} /></main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
