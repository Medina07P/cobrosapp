import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estadoInicial, reducirCarga } from './carga.js'

test('estado inicial: cargando, sin datos ni error', () => {
  assert.deepEqual(estadoInicial, { datos: null, cargando: true, error: '' })
})

test('inicio conserva el error y los datos (el aviso sigue visible mientras se reintenta)', () => {
  const e = reducirCarga({ datos: null, cargando: false, error: 'falló' }, { tipo: 'inicio' })
  assert.deepEqual(e, { datos: null, cargando: true, error: 'falló' })
})

test('éxito guarda los datos y limpia el error', () => {
  const e = reducirCarga({ datos: null, cargando: true, error: 'falló' }, { tipo: 'exito', datos: [1] })
  assert.deepEqual(e, { datos: [1], cargando: false, error: '' })
})

test('fallo guarda el mensaje y conserva los datos previos', () => {
  const e = reducirCarga({ datos: [1], cargando: true, error: '' }, { tipo: 'fallo', mensaje: 'sin red' })
  assert.deepEqual(e, { datos: [1], cargando: false, error: 'sin red' })
})

test('fin solo apaga cargando (el aviso se dio por otra vía)', () => {
  const e = reducirCarga({ datos: [1], cargando: true, error: '' }, { tipo: 'fin' })
  assert.deepEqual(e, { datos: [1], cargando: false, error: '' })
})

test('poner acepta un valor o una función sobre los datos previos', () => {
  assert.deepEqual(reducirCarga({ datos: { a: 1 }, cargando: false, error: '' }, { tipo: 'poner', datos: { a: 2 } }).datos, { a: 2 })
  assert.deepEqual(reducirCarga({ datos: { a: 1 }, cargando: false, error: '' }, { tipo: 'poner', datos: (p) => ({ ...p, b: 3 }) }).datos, { a: 1, b: 3 })
})

test('una acción desconocida devuelve el mismo estado', () => {
  const s = { datos: null, cargando: true, error: '' }
  assert.equal(reducirCarga(s, { tipo: 'nada' }), s)
})
