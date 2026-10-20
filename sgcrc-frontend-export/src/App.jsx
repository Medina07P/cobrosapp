import { useEffect, useState } from 'react'
import { api, setApiKey } from './api.js'
import { aplicarColorTema, COLOR_POR_DEFECTO } from './lib/colorTema.js'
import Icon from './ui/Icon.jsx'
import Logo from './ui/Logo.jsx'
import Button from './ui/Button.jsx'
import Login from './views/Login.jsx'
import Dashboard from './views/Dashboard.jsx'
import Clientes from './views/Clientes.jsx'
import Suscripciones from './views/Suscripciones.jsx'
import Historial from './views/Historial.jsx'
import Calendario from './views/Calendario.jsx'
import Planes from './views/Planes.jsx'
import Configuracion from './views/Configuracion.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'squares-four' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'planes', label: 'Planes', icon: 'tag' },
  { id: 'suscripciones', label: 'Suscripciones', icon: 'arrows-clockwise' },
  { id: 'historial', label: 'Historial', icon: 'clock-counter-clockwise' },
  { id: 'calendario', label: 'Calendario', icon: 'calendar-blank' },
  { id: 'configuracion', label: 'Configuración', icon: 'gear' },
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
    if (!session) return
    // Si la sesión cambia (logout/login) mientras la petición está en curso, se ignora su resultado.
    let vigente = true

    const refrescarConfiguracion = async () => {
      try {
        const perfil = await api.getPerfil()
        if (!vigente) return
        aplicarColorTema(document.documentElement, perfil.color_tema)
        // Actualizamos la sesión local por si el nombre cambió
        setSession((s) => {
          if (!s) return s
          const nueva = { ...s, user: perfil }
          localStorage.setItem('sgcrc_session', JSON.stringify(nueva))
          return nueva
        })
      } catch (err) {
        if (!vigente) return
        if (err.response?.status === 401) handleLogout()
        // Si falla el fetch inicial, usamos lo que tengamos en sesión
        else aplicarColorTema(document.documentElement, session.user?.color_tema)
      }
    }

    refrescarConfiguracion()
    return () => { vigente = false }
  }, [session?.token]) // Se ejecuta solo cuando cambia el token (login)

  // 2. HEALTH CHECK Y LOGOUT AUTOMÁTICO
  useEffect(() => {
    if (!session) return
    api.health()
      .then(() => setBackendOk(true))
      .catch((err) => {
        if (err.response?.status === 401) handleLogout()
        else setBackendOk(false)
      })
  }, [session?.token])

  const handleLogout = () => {
    localStorage.removeItem('sgcrc_session')
    setApiKey('')
    setSession(null)
    setBackendOk(null)
    setView('dashboard')
    aplicarColorTema(document.documentElement, COLOR_POR_DEFECTO)
  }

  // Refleja en el shell lo guardado en Configuración (el updater funcional evita cierres obsoletos).
  const handleGuardado = (payload) => {
    setSession((s) => {
      if (!s) return s
      const nueva = { ...s, user: { ...s.user, ...payload } }
      localStorage.setItem('sgcrc_session', JSON.stringify(nueva))
      return nueva
    })
  }

  // 3. REGISTRO DE VISTAS (sin memoizar: así onGuardado nunca queda obsoleto)
  const VIEWS = {
    dashboard: <Dashboard />,
    clientes: <Clientes />,
    planes: <Planes />,
    suscripciones: <Suscripciones />,
    historial: <Historial />,
    calendario: <Calendario />,
    configuracion: <Configuracion onGuardado={handleGuardado} />,
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

  const estadoTexto = backendOk === null ? 'Comprobando servidor…' : backendOk ? 'Servidor conectado' : 'Sin conexión con el servidor'
  const estadoServidor = (
    <span className="estado-server" data-ok={backendOk === null ? undefined : String(backendOk)} role="status">
      <i aria-hidden="true" />{estadoTexto}
    </span>
  )
  const nombreEmpresa = session.user?.nombre || 'Mi negocio'

  const items = () => NAV.map((n) => (
    <button
      key={n.id}
      type="button"
      className="nav-item"
      aria-current={view === n.id ? 'page' : undefined}
      onClick={() => setView(n.id)}
    >
      <Icon name={n.icon} size={20} />
      {n.label}
    </button>
  ))

  return (
    <div className="shell">
      <a className="saltar" href="#contenido">Saltar al contenido</a>

      <aside className="lateral">
        <div className="marca"><Logo size={30} decorativo /><span>SGCRC</span></div>
        <p className="empresa">Empresa<strong>{nombreEmpresa}</strong></p>
        <nav className="nav" aria-label="Principal">{items()}</nav>
        <div className="lateral-pie">
          {estadoServidor}
          <Button variante="secundario" icono="sign-out" onClick={handleLogout}>Salir</Button>
        </div>
      </aside>

      <main id="contenido" className="contenido" tabIndex={-1}>
        <div className="barra-movil">
          <div className="marca"><Logo size={26} decorativo /><span>SGCRC</span></div>
          {estadoServidor}
          <Button variante="secundario" tam="sm" icono="sign-out" onClick={handleLogout}>Salir</Button>
        </div>
        <nav className="nav-movil" aria-label="Principal">{items()}</nav>
        {VIEWS[view]}
      </main>
    </div>
  )
}
