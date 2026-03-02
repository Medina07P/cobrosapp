import { useEffect, useMemo, useState } from 'react'
import { api, setApiKey } from './api.js' // Nota: Seguimos usando setApiKey pero ahora le pasaremos el Token
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
  
  // Usamos localStorage en lugar de sessionStorage para que la sesión no se borre al cerrar la pestaña
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem('sgcrc_session')
    return raw ? JSON.parse(raw) : null
  })

  // Sincronizar el Token con el objeto de la API
  useEffect(() => {
    if (session?.token) {
      // Configuramos el header Authorization: Bearer <token>
      setApiKey(`Bearer ${session.token}`) 
    } else {
      setApiKey('')
    }
  }, [session])

  // Verificar salud del backend
  useEffect(() => {
    if (!session) return
    api.health()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false))
  }, [session])

  // Memoizamos las vistas para que no se rendericen innecesariamente
  const VIEWS = useMemo(() => ({
    dashboard: <Dashboard />,
    clientes: <Clientes />,
    suscripciones: <Suscripciones />,
    historial: <Historial />,
    calendario: <Calendario />,
  }), [])

  // Función para cerrar sesión de forma segura
  const handleLogout = () => {
    localStorage.removeItem('sgcrc_session')
    setSession(null)
    setBackendOk(null)
    setView('dashboard')
  }

  // Si no hay sesión, mostramos el Login
  if (!session) {
    return (
      <Login onLogin={(data) => { 
        // Guardamos todo el objeto (incluyendo token y datos del usuario)
        localStorage.setItem('sgcrc_session', JSON.stringify(data)); 
        setSession(data);
      }} />
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 text-slate-100 p-4 gap-2">
        <div className="text-xl font-bold mb-1 flex items-center gap-2">
          <span className="text-indigo-400">●</span> SGCRC
        </div>
        <div className="text-[10px] text-slate-500 mb-6 uppercase tracking-widest font-bold">
          Usuario: {session.nombre || 'Admin'}
        </div>
        
        {NAV.map((n) => (
          <button 
            key={n.id} 
            onClick={() => setView(n.id)} 
            className={`text-left px-3 py-2 rounded-lg transition text-sm ${view === n.id ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            {n.label}
          </button>
        ))}
      </aside>

      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        <header className="bg-white rounded-xl p-4 shadow-sm mb-4 flex items-center justify-between gap-3 border border-slate-200">
          <div>
            <h1 className="font-bold text-slate-800">Panel de {session.nombre}</h1>
            <p className="text-xs text-slate-400">Gestión de Cobros Recurrentes</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${backendOk ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
              {backendOk === null ? 'Conectando...' : backendOk ? 'Online' : 'Offline'}
            </span>
            <button 
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition" 
              onClick={handleLogout}
            >
              Cerrar Sesión
            </button>
          </div>
        </header>

        {/* Navegación móvil */}
        <div className="md:hidden bg-white rounded-xl p-2 shadow-sm mb-4 flex flex-wrap gap-2 border border-slate-200">
          {NAV.map((n) => (
            <button 
              key={n.id} 
              onClick={() => setView(n.id)} 
              className={`text-xs px-3 py-2 rounded-lg font-medium ${view === n.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {n.label}
            </button>
          ))}
        </div>

        {/* Renderizado de la vista actual */}
        <div className="animate-in fade-in duration-500">
          {VIEWS[view]}
        </div>
      </main>
    </div>
  )
}