import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mensajeError, MSG_RED, MSG_INESPERADO, MSG_RESPUESTA_INVALIDA } from './errores.js'

const marcar = (e, marca) => Object.assign(e, { [marca]: true })

test('un error de red marcado por api.js se traduce al español', () => {
  assert.equal(mensajeError(marcar(new TypeError('Failed to fetch'), 'esRed')), MSG_RED)
  assert.equal(mensajeError(marcar(new TypeError('Load failed'), 'esRed')), MSG_RED)
  assert.equal(MSG_RED, 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
})

test('un Error con mensaje conserva el mensaje del backend', () => {
  assert.equal(mensajeError(new Error('Cliente con suscripciones vinculadas.')), 'Cliente con suscripciones vinculadas.')
})

test('valores sin mensaje usan el texto genérico', () => {
  assert.equal(mensajeError(null), MSG_INESPERADO)
  assert.equal(mensajeError(undefined), MSG_INESPERADO)
  assert.equal(mensajeError({}), MSG_INESPERADO)
  assert.equal(mensajeError(new Error('')), MSG_INESPERADO)
  assert.equal(mensajeError({ message: 42 }), MSG_INESPERADO)
  assert.equal(MSG_INESPERADO, 'Ocurrió un error inesperado.')
})

test('una respuesta no JSON marcada por api.js (p. ej. HTML del túnel) se traduce al español', () => {
  const esperado = 'El servidor respondió algo inesperado. Inténtalo de nuevo en un momento.'
  assert.equal(mensajeError(marcar(new SyntaxError("Unexpected token '<'"), 'respuestaInvalida')), esperado)
  assert.equal(MSG_RESPUESTA_INVALIDA, esperado)
})

test('un TypeError o SyntaxError sin marca es un bug de programación: no se muestra su texto técnico', () => {
  assert.equal(mensajeError(new TypeError("Cannot read properties of undefined (reading 'map')")), MSG_INESPERADO)
  assert.equal(mensajeError(new SyntaxError('Unexpected token')), MSG_INESPERADO)
})

test('"Error NNN" (código HTTP sin cuerpo JSON) se traduce al español', () => {
  assert.equal(mensajeError(new Error('Error 502')), 'El servidor no pudo completar la operación (código 502). Inténtalo de nuevo.')
  assert.equal(mensajeError(new Error('Error 500')), 'El servidor no pudo completar la operación (código 500). Inténtalo de nuevo.')
})

test('mensajes parecidos pero distintos a "Error NNN" se conservan', () => {
  assert.equal(mensajeError(new Error('Error 50')), 'Error 50')
  assert.equal(mensajeError(new Error('Error 5000')), 'Error 5000')
  assert.equal(mensajeError(new Error('Error 502 en proxy')), 'Error 502 en proxy')
  assert.equal(mensajeError(new Error('Error de validación')), 'Error de validación')
})
