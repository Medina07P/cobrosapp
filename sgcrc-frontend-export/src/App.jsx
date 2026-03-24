import { useEffect, useMemo, useState } from 'react'
import { api, setApiKey } from './api.js'
import Login from './views/Login.jsx'
import Dashboard from './views/Dashboard.jsx'
import Clientes from './views/Clientes.jsx'
import Suscripciones from './views/Suscripciones.jsx'
import Historial from './views/Historial.jsx'
import Calendario from './views/Calendario.jsx'
import Planes from './views/Planes.jsx' 
import Configuracion from './views/Configuracion.jsx' // IMPORTANTE: Importar tu nueva vista

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'planes', label: 'Catálogo de Planes' },
  { id: 'suscripciones', label: 'Suscripciones' },
  { id: 'historial', label: 'Historial' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'configuracion', label: '⚙️ Configuración' }, // Añadido al menú
]

export default function App() {
  const [view, setView] = useState('dashboard')
  const [backendOk, setBackendOk] = useState(null)
  
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem('sgcrc_session')
    if (raw) {
      try {
        const data = JSON.parse(raw)
        if (data.token) {
          setApiKey(`Bearer ${data.token}`)
        }
        return data
      } catch (e) { return null }
    }
    return null
  })

  // 1. EFECTO PARA SINCRONIZAR COLOR Y NOMBRE DESDE LA DB AL ENTRAR
  useEffect(() => {
    if (!session) return;

    const refrescarConfiguracion = async () => {
      try {
        const perfil = await api.getPerfil();
        // Actualizamos las variables CSS
        const color = perfil.color_tema || '#4f46e5';
        document.documentElement.style.setProperty('--color-primario', color);
        document.documentElement.style.setProperty('--color-primario-glow', `${color}33`);
        
        // Actualizamos la sesión local por si el nombre cambió
        const nuevaSesion = { ...session, user: perfil };
        setSession(nuevaSesion);
        localStorage.setItem('sgcrc_session', JSON.stringify(nuevaSesion));
      } catch (err) {
        // Si falla el fetch inicial, usamos lo que tengamos en sesión
        const colorDefault = session.user?.color_tema || '#4f46e5';
        document.documentElement.style.setProperty('--color-primario', colorDefault);
        document.documentElement.style.setProperty('--color-primario-glow', `${colorDefault}33`);
      }
    };

    refrescarConfiguracion();
  }, [session?.token]); // Se ejecuta solo cuando cambia el token (login)

  // 2. HEALTH CHECK Y LOGOUT AUTOMÁTICO
  useEffect(() => {
    if (!session) return
    api.health()
      .then(() => setBackendOk(true))
      .catch((err) => {
        if (err.response?.status === 401) handleLogout()
        else setBackendOk(false)
      })
  }, [session])

  // 3. REGISTRO DE VISTAS (Añadido configuración)
  const VIEWS = useMemo(() => ({
    dashboard: <Dashboard />,
    clientes: <Clientes />,
    planes: <Planes />,
    suscripciones: <Suscripciones />,
    historial: <Historial />,
    calendario: <Calendario />,
    configuracion: <Configuracion onUpdate={() => setView('dashboard')} />, // Pasamos callback por si quieres redirigir tras guardar
  }), [])

  const handleLogout = () => {
    localStorage.removeItem('sgcrc_session')
    setApiKey('') 
    setSession(null)
    setBackendOk(null)
    setView('dashboard')
  }

  if (!session) {
    return (
      <Login onLogin={(data) => { 
        setApiKey(`Bearer ${data.token}`)
        localStorage.setItem('sgcrc_session', JSON.stringify(data))
        setSession(data)
      }} />
    )
  }

  // Estilos dinámicos para la navegación activa
  const activeStyle = {
    backgroundColor: 'var(--color-primario)',
    boxShadow: '0 4px 12px var(--color-primario-glow)',
    color: 'white'
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 text-slate-100 p-4 gap-2 shadow-2xl">
        <div className="text-xl font-bold mb-1 flex items-center gap-2 px-2 py-4">
          <span style={{ color: 'var(--color-primario)' }}>●</span> 
          <span className="tracking-tight">SGCRC</span>
        </div>
        
        <div className="text-[10px] text-slate-500 mb-6 uppercase tracking-widest font-bold px-2 bg-slate-800/50 py-2 rounded-lg border border-slate-700/50">
          Empresa: {session.user?.nombre || 'Café Valdore'}
        </div>
        
        <nav className="flex-1 flex flex-col gap-1">
          {NAV.map((n) => (
            <button 
              key={n.id} 
              onClick={() => setView(n.id)} 
              style={view === n.id ? activeStyle : {}}
              className={`text-left px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold ${
                view === n.id ? '' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              } ${n.id === 'configuracion' ? 'mt-auto pt-4 border-t border-slate-800' : ''}`}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        {/* Header Superior */}
        <header className="bg-white rounded-2xl p-5 shadow-sm mb-6 flex items-center justify-between gap-3 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
              style={{ backgroundColor: 'var(--color-primario)' }}
            >
              {(session.user?.nombre || 'C').charAt(0)}
            </div>
            <div>
              <h1 className="font-extrabold text-slate-800 tracking-tight">
                {session.user?.nombre || 'Café Valdore'}
              </h1>
              <p className="text-xs text-slate-400 font-medium italic">Sistema de Gestión de Cobros</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Estado Server</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                backendOk ? 'text-emerald-500' : 'text-red-400'
              }`}>
                {backendOk ? '● Conectado' : '● Error'}
              </span>
            </div>
            
            <button 
              className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-300 border border-transparent hover:border-red-100" 
              onClick={handleLogout}
            >
              Salir
            </button>
          </div>
        </header>

        {/* Navigation - Mobile */}
        <div className="md:hidden bg-white rounded-2xl p-2 shadow-sm mb-6 flex flex-wrap gap-2 border border-slate-200/60">
          {NAV.map((n) => (
            <button 
              key={n.id} 
              onClick={() => setView(n.id)} 
              style={view === n.id ? { backgroundColor: 'var(--color-primario)' } : {}}
              className={`text-[11px] px-4 py-2 rounded-xl font-bold transition-all ${
                view === n.id ? 'text-white shadow-md' : 'bg-slate-50 text-slate-500'
              }`}
            >
              {n.label.replace('⚙️ ', '')}
            </button>
          ))}
        </div>

        {/* Contenedor de Vistas con Animación */}
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out">
          {VIEWS[view]}
        </div>
      </main>
    </div>
  )
}