import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { siguienteFoco } from '../lib/focoDialog.js'

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Solo los visibles: un enfocable con display:none no recibe foco y rompería la trampa.
const visibles = (el) => [...el.querySelectorAll(ENFOCABLES)].filter((n) => n.getClientRects().length > 0)

// Pila de diálogos abiertos (el último es el de arriba) y overflow original del body,
// compartidos por todas las instancias para que cierres fuera de orden no desbloqueen de más.
const pila = []
let desbordeOriginal = ''

export default function Dialog({ abierto, titulo, onCerrar, cerrable = true, pie, rol = 'dialog', children }) {
  const raiz = useRef(null)
  const idTitulo = useId()
  const idCuerpo = useId()
  // Refs para que el efecto dependa solo de `abierto` (no se reinicia el foco si cambia un callback)
  const cerrarRef = useRef(onCerrar)
  const cerrableRef = useRef(cerrable)
  cerrarRef.current = onCerrar
  cerrableRef.current = cerrable
  const fichaRef = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined
    const el = raiz.current
    const previo = document.activeElement
    const ficha = {}
    fichaRef.current = ficha
    if (pila.length === 0) {
      desbordeOriginal = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    pila.push(ficha)
    ;(el.querySelector('[data-autofocus]') || visibles(el)[0] || el).focus()

    const alTeclear = (e) => {
      if (pila[pila.length - 1] !== ficha) return // solo responde el diálogo de arriba
      if (e.key === 'Escape' && cerrableRef.current) {
        e.stopPropagation()
        cerrarRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const lista = visibles(el)
      const destino = siguienteFoco(lista, document.activeElement, e.shiftKey)
      if (destino) {
        e.preventDefault()
        destino.focus()
      } else if (lista.length === 0 || !el.contains(document.activeElement)) {
        // Nada a donde mover el foco (p. ej. todo deshabilitado): se retiene en el diálogo
        e.preventDefault()
        el.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)

    // Chrome dispara focusout (relatedTarget null) de forma asíncrona cuando el botón enfocado pasa
    // a disabled; el diálogo es modal, así que el foco que sale se devuelve (tras un tick).
    let activo = true
    let temporizador = null
    const alPerderFoco = (e) => {
      if (pila[pila.length - 1] !== ficha) return
      if (e.relatedTarget && el.contains(e.relatedTarget)) return
      clearTimeout(temporizador)
      temporizador = setTimeout(() => {
        if (!activo || pila[pila.length - 1] !== ficha) return
        if (!el.contains(document.activeElement)) el.focus()
      }, 0)
    }
    el.addEventListener('focusout', alPerderFoco)
    return () => {
      activo = false
      clearTimeout(temporizador)
      el.removeEventListener('focusout', alPerderFoco)
      document.removeEventListener('keydown', alTeclear)
      const i = pila.indexOf(ficha)
      if (i !== -1) pila.splice(i, 1)
      if (fichaRef.current === ficha) fichaRef.current = null
      if (pila.length === 0) document.body.style.overflow = desbordeOriginal
      if (previo && typeof previo.focus === 'function') previo.focus()
    }
  }, [abierto])

  // Tras cada render: si el foco ya quedó fuera del diálogo, volver a él (solo el de arriba).
  // La pérdida asíncrona de foco al deshabilitar botones la cubre el focusout del efecto principal.
  useEffect(() => {
    if (!abierto || !raiz.current) return
    if (pila[pila.length - 1] !== fichaRef.current) return
    if (!raiz.current.contains(document.activeElement)) raiz.current.focus()
  })

  if (!abierto) return null
  return createPortal(
    <div
      className="dialog-velo"
      onMouseDown={(e) => { if (e.target === e.currentTarget && cerrable) onCerrar?.() }}
    >
      <div ref={raiz} className="dialog" role={rol} aria-modal="true" aria-labelledby={idTitulo} aria-describedby={idCuerpo} tabIndex={-1}>
        <h2 id={idTitulo} className="dialog-titulo">{titulo}</h2>
        <div id={idCuerpo} className="dialog-cuerpo">{children}</div>
        {pie && <div className="dialog-pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}
