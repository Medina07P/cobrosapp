// Almacén de notificaciones (toasts). Puro y sin React: se lee con useSyncExternalStore.
const MAX_VISIBLES = 4

export function crearTostadas({ duracion = 5000, programar = setTimeout, cancelar = clearTimeout } = {}) {
  let items = []
  let siguiente = 1
  const oyentes = new Set()
  const temporizadores = new Map()

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

  const mostrar = (mensaje, tipo = 'info') => {
    if (items.length >= MAX_VISIBLES) cerrar(items[0].id)
    const id = siguiente++
    items = [...items, { id, mensaje, tipo }]
    temporizadores.set(id, programar(() => cerrar(id), tipo === 'error' ? duracion * 2 : duracion))
    avisar()
    return id
  }

  const subscribe = (fn) => {
    oyentes.add(fn)
    return () => { oyentes.delete(fn) }
  }

  return { mostrar, cerrar, subscribe, getSnapshot: () => items }
}
