export const MSG_RED = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
export const MSG_RESPUESTA_INVALIDA = 'El servidor respondió algo inesperado. Inténtalo de nuevo en un momento.'
export const MSG_INESPERADO = 'Ocurrió un error inesperado.'

// Texto en español para mostrar al usuario a partir de cualquier error capturado.
// api.js marca los fallos de red (fetch rechaza) con `esRed` y las respuestas OK que no son JSON con
// `respuestaInvalida`. Un TypeError/SyntaxError sin marca es un error de programación y no se muestra.
// src/api.js construye "Error NNN" cuando no hay cuerpo JSON.
export function mensajeError(e) {
  if (e && e.esRed) return MSG_RED
  if (e && e.respuestaInvalida) return MSG_RESPUESTA_INVALIDA
  if (e instanceof TypeError || e instanceof SyntaxError) return MSG_INESPERADO
  const m = e && typeof e === 'object' ? e.message : undefined
  if (typeof m !== 'string' || !m) return MSG_INESPERADO
  const http = /^Error (\d{3})$/.exec(m)
  if (http) return `El servidor no pudo completar la operación (código ${http[1]}). Inténtalo de nuevo.`
  return m
}
