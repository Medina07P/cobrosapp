import { useEffect, useMemo, useState } from 'react'
import { api, setApiKey } from './api.js'
import Login from './views/Login.jsx'
import Dashboard from './views/Dashboard.jsx'
import Clientes from './views/Clientes.jsx'
import Suscripciones from './views/Suscripciones.jsx'
import Historial from './views/Historial.jsx'
import Calendario from './views/Calendario.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'suscripciones', label: 'Suscripciones' },
  { id: 'historial', label: 'Historial' },
  { id: 'calendario', label: 'Calendario' },
]

export default function App() {
  const [view, setView] = useState('dashboard')
  const [backendOk, setBackendOk] = useState(null)
  const [session, setSession] = useState(() => {
    const raw = sessionStorage.getItem('sgcrc_session')
    return raw ? JSON.parse(raw) : null
  })

  useEffect(() => {
    setApiKey(session?.apiKey || import.meta.env.VITE_API_KEY || '')
  }, [session])

  useEffect(() => {
    if (!session) return
    api.health().then(() => setBackendOk(true)).catch(() => setBackendOk(false))
  }, [session])

  const VIEWS = useMemo(() => ({
    dashboard: <Dashboard />,
    clientes: <Clientes />,
    suscripciones: <Suscripciones />,
    historial: <Historial />,
    calendario: <Calendario />,
  }), [])

  if (!session) {
    return <Login onLogin={(data) => { sessionStorage.setItem('sgcrc_session', JSON.stringify(data)); setSession(data) }} />
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 text-slate-100 p-4 gap-2">
        <div className="text-xl font-bold mb-4">SGCRC</div>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setView(n.id)} className={`text-left px-3 py-2 rounded-lg transition ${view === n.id ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}>
            {n.label}
          </button>
        ))}
      </aside>

      <main className="flex-1 p-4 md:p-6">
        <header className="bg-white rounded-xl p-4 shadow-sm mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-lg">Sistema de Gestión de Cobros Recurrentes</h1>
            <p className="text-sm text-slate-500">Panel administrativo</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${backendOk ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {backendOk === null ? 'Conectando...' : backendOk ? 'Backend activo' : 'Backend offline'}
            </span>
            <button className="text-sm px-3 py-1 rounded-lg bg-slate-900 text-white" onClick={() => { sessionStorage.removeItem('sgcrc_session'); setSession(null) }}>Salir</button>
          </div>
        </header>

        <div className="md:hidden bg-white rounded-xl p-2 shadow-sm mb-4 flex flex-wrap gap-2">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)} className={`text-sm px-3 py-2 rounded-lg ${view === n.id ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>{n.label}</button>
          ))}
        </div>

        {VIEWS[view]}
      </main>
    </div>
  )
}
