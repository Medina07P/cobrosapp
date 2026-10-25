// Estado de carga de una vista, sin React: lo consume lib/useCarga.js.
// datos === null significa "aún no hubo una carga correcta" (se muestra Skeleton o el error inicial).
export const estadoInicial = { datos: null, cargando: true, error: '' }

export function reducirCarga(estado, accion) {
  switch (accion.tipo) {
    case 'inicio': // el error previo se conserva: el aviso sigue en pantalla mientras se reintenta
      return { ...estado, cargando: true }
    case 'exito':
      return { datos: accion.datos, cargando: false, error: '' }
    case 'fallo':
      return { ...estado, cargando: false, error: accion.mensaje }
    case 'fin':
      return { ...estado, cargando: false }
    case 'poner': {
      const datos = typeof accion.datos === 'function' ? accion.datos(estado.datos) : accion.datos
      return { ...estado, datos }
    }
    default:
      return estado
  }
}
