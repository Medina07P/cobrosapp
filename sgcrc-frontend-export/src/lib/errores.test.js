import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mensajeError, MSG_RED, MSG_INESPERADO } from './errores.js'

test('un TypeError de red se traduce al español', () => {
  assert.equal(mensajeError(new TypeError('Failed to fetch')), MSG_RED)
  assert.equal(mensajeError(new TypeError('Load failed')), MSG_RED)
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
