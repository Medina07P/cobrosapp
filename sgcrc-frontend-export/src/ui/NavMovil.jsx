import { useEffect, useRef, useState } from 'react'
import { particionarNav, vistaEnMas } from '../lib/navegacion.js'
import Icon from './Icon.jsx'
import Button from './Button.jsx'

// Barra de navegación inferior (móvil) con un panel "Más" para los destinos restantes y "Salir".
export default function NavMovil({ view, onNavegar, onSalir }) {
  const { barra, mas } = particionarNav()
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)
  const botonMas = useRef(null)
  const panel = useRef(null)

  useEffect(() => {
    if (!abierto) return
    panel.current?.querySelector('button')?.focus()
    const alPulsar = (e) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        botonMas.current?.focus()
      }
    }
    const alClicFuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('keydown', alPulsar)
    document.addEventListener('mousedown', alClicFuera)
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.removeEventListener('mousedown', alClicFuera)
    }
  }, [abierto])

  const elegir = (id) => { setAbierto(false); onNavegar(id) }
  const salir = () => { setAbierto(false); onSalir() }

  return (
    <div ref={contenedor} className="nav-movil-contenedor">
      <div id="panel-mas" ref={panel} className="panel-mas" hidden={!abierto}>
        {mas.map((n) => (
          <button
            key={n.id} type="button" className="nav-item"
            aria-current={view === n.id ? 'page' : undefined}
            onClick={() => elegir(n.id)}
          >
            <Icon name={n.icon} size={20} />
            {n.label}
          </button>
        ))}
        <Button variante="secundario" icono="sign-out" onClick={salir}>Salir</Button>
      </div>
      <nav className="nav-inferior" aria-label="Principal">
        {barra.map((n) => (
          <button
            key={n.id} type="button" className="nav-inf-item"
            aria-current={view === n.id ? 'page' : undefined}
            onClick={() => elegir(n.id)}
          >
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </button>
        ))}
        <button
          ref={botonMas} type="button" className="nav-inf-item"
          aria-expanded={abierto} aria-controls="panel-mas"
          aria-current={vistaEnMas(view) ? 'page' : undefined}
          onClick={() => setAbierto((a) => !a)}
        >
          <Icon name="list" size={22} />
          <span>Más</span>
        </button>
      </nav>
    </div>
  )
}
