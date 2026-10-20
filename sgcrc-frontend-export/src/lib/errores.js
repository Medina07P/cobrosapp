export const MSG_RED = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
export const MSG_RESPUESTA_INVALIDA = 'El servidor respondió algo inesperado. Inténtalo de nuevo en un momento.'
export const MSG_INESPERADO = 'Ocurrió un error inesperado.'

// Texto en español para mostrar al usuario a partir de cualquier error capturado.
// fetch lanza TypeError ("Failed to fetch", "Load failed"...) cuando falla la red; res.json() lanza
// SyntaxError si el túnel responde HTML; src/api.js construye "Error NNN" cuando no hay cuerpo JSON.
export function mensajeError(e) {
  if (e instanceof TypeError) return MSG_RED
  if (e instanceof SyntaxError) return MSG_RESPUESTA_INVALIDA
  const m = e && typeof e === 'object' ? e.message : undefined
  if (typeof m !== 'string' || !m) return MSG_INESPERADO
  const http = /^Error (\d{3})$/.exec(m)
  if (http) return `El servidor no pudo completar la operación (código ${http[1]}). Inténtalo de nuevo.`
  return m
}
