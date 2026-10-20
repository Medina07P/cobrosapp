export const MSG_RED = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
export const MSG_INESPERADO = 'Ocurrió un error inesperado.'

// Texto en español para mostrar al usuario a partir de cualquier error capturado.
// fetch lanza TypeError ("Failed to fetch", "Load failed"...) cuando falla la red.
export function mensajeError(e) {
  if (e instanceof TypeError) return MSG_RED
  const m = e && typeof e === 'object' ? e.message : undefined
  return typeof m === 'string' && m ? m : MSG_INESPERADO
}
