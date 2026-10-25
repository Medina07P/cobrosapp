// Almacén de notificaciones (toasts). Puro y sin React: se lee con useSyncExternalStore.
const MAX_VISIBLES = 4

export function crearTostadas({ duracion = 5000, programar = setTimeout, cancelar = clearTimeout } = {}) {
  let items = []
  let siguiente = 1
  const oyentes = new Set()
  const temporizadores = new Map()
  let pausado = false

  const avisar = () => { oyentes.forEach((fn) => fn()) }

  const cerrar = (id) => {
    if (temporizadores.has(id)) {
      cancelar(temporizadores.get(id))
      temporizadores.delete(id)
    }
    const quedan = items.filter((t) => t.id !== id)
    if (quedan.length === items.length) return
    items = quedan
    avisar()
  }

  const programarCierre = (t) => {
    temporizadores.set(t.id, programar(() => cerrar(t.id), t.tipo === 'error' ? duracion * 2 : duracion))
  }

  const mostrar = (mensaje, tipo = 'info') => {
    if (items.length >= MAX_VISIBLES) cerrar(items[0].id)
    const id = siguiente++
    const t = { id, mensaje, tipo }
    items = [...items, t]
    if (!pausado) programarCierre(t)
    avisar()
    return id
  }

  // Mientras el puntero o el foco están sobre los avisos, no se cierran solos (WCAG 2.2.1)
  const pausar = () => {
    pausado = true
    temporizadores.forEach((tm) => cancelar(tm))
    temporizadores.clear()
  }

  const reanudar = () => {
    pausado = false
    items.forEach((t) => { if (!temporizadores.has(t.id)) programarCierre(t) })
  }

  const subscribe = (fn) => {
    oyentes.add(fn)
    return () => { oyentes.delete(fn) }
  }

  return { mostrar, cerrar, pausar, reanudar, subscribe, getSnapshot: () => items }
}
