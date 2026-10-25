import { createPortal } from 'react-dom'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { crearTostadas } from '../lib/toastStore.js'
import Icon from './Icon.jsx'

const tostadas = crearTostadas()

// API imperativa: se puede llamar desde cualquier parte, sin Provider.
export const toast = {
  exito: (mensaje) => tostadas.mostrar(mensaje, 'ok'),
  error: (mensaje) => tostadas.mostrar(mensaje, 'error'),
  info: (mensaje) => tostadas.mostrar(mensaje, 'info'),
}

const ICONOS = { ok: 'check-circle', error: 'warning-circle', info: 'bell' }

// Montar UNA vez (main.jsx). La región vive siempre en el DOM para que los lectores de pantalla anuncien los avisos.
export function ToastRegion() {
  const items = useSyncExternalStore(tostadas.subscribe, tostadas.getSnapshot)
  const regionRef = useRef(null)
  const punteroDentro = useRef(false)
  const focoDentro = useRef(false)

  // La pausa combina puntero y foco: solo se reanuda cuando ninguno está dentro.
  const sincronizar = () => {
    if (punteroDentro.current || focoDentro.current) tostadas.pausar()
    else tostadas.reanudar()
  }

  // Si el elemento enfocado se desmontó (p. ej. el botón de cerrar), el navegador no dispara blur:
  // se comprueba tras cada cambio de cantidad de avisos para no dejar los demás pausados.
  useEffect(() => {
    if (focoDentro.current && !regionRef.current?.contains(document.activeElement)) {
      focoDentro.current = false
      sincronizar()
    }
  }, [items.length])

  return createPortal(
    <div
      ref={regionRef}
      className="toast-region"
      aria-live="polite"
      aria-relevant="additions"
      onMouseEnter={() => { punteroDentro.current = true; sincronizar() }}
      onMouseLeave={() => { punteroDentro.current = false; sincronizar() }}
      onFocus={() => { focoDentro.current = true; sincronizar() }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          focoDentro.current = false
          sincronizar()
        }
      }}
    >
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tipo}`}>
          <Icon name={ICONOS[t.tipo]} size={20} />
          <span className="toast-texto">{t.mensaje}</span>
          <button type="button" className="toast-cerrar" onClick={() => tostadas.cerrar(t.id)}>
            <Icon name="x" size={16} label="Cerrar notificación" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
