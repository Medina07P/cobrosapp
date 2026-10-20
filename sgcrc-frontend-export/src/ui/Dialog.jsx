import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { siguienteFoco } from '../lib/focoDialog.js'

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export default function Dialog({ abierto, titulo, onCerrar, cerrable = true, pie, children }) {
  const raiz = useRef(null)
  const idTitulo = useId()
  // Refs para que el efecto dependa solo de `abierto` (no se reinicia el foco si cambia un callback)
  const cerrarRef = useRef(onCerrar)
  const cerrableRef = useRef(cerrable)
  cerrarRef.current = onCerrar
  cerrableRef.current = cerrable

  useEffect(() => {
    if (!abierto) return undefined
    const el = raiz.current
    const previo = document.activeElement
    const desbordeAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ;(el.querySelector('[data-autofocus]') || el.querySelector(ENFOCABLES) || el).focus()

    const alTeclear = (e) => {
      if (e.key === 'Escape' && cerrableRef.current) {
        e.stopPropagation()
        cerrarRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const destino = siguienteFoco([...el.querySelectorAll(ENFOCABLES)], document.activeElement, e.shiftKey)
      if (destino) {
        e.preventDefault()
        destino.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = desbordeAnterior
      if (previo && typeof previo.focus === 'function') previo.focus()
    }
  }, [abierto])

  if (!abierto) return null
  return createPortal(
    <div
      className="dialog-velo"
      onMouseDown={(e) => { if (e.target === e.currentTarget && cerrable) onCerrar?.() }}
    >
      <div ref={raiz} className="dialog" role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}>
        <h2 id={idTitulo} className="dialog-titulo">{titulo}</h2>
        <div className="dialog-cuerpo">{children}</div>
        {pie && <div className="dialog-pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}
