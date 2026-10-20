import { createPortal } from 'react-dom'
import { useSyncExternalStore } from 'react'
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
  return createPortal(
    <div className="toast-region" aria-live="polite" aria-relevant="additions">
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
