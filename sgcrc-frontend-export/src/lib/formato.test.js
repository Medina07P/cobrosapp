import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmt, fmtFecha, esHoyLocal } from './formato.js'

test('fmt da pesos colombianos sin decimales', () => {
  const s = fmt(1234567).replace(/\s/g, ' ')
  assert.match(s, /^\$\s?1\.234\.567$/)
})

test('fmtFecha pasa AAAA-MM-DD a DD/MM/AAAA sin desfase de zona horaria', () => {
  assert.equal(fmtFecha('2026-10-05'), '05/10/2026')
  assert.equal(fmtFecha('2026-01-31T10:00:00'), '31/01/2026')
})

test('fmtFecha devuelve cadena vacía si no hay fecha válida', () => {
  assert.equal(fmtFecha(''), '')
  assert.equal(fmtFecha(null), '')
  assert.equal(fmtFecha('mañana'), '')
})

test('esHoyLocal: un envío a las 20:00 locales cuenta como hoy aunque en UTC sea mañana', () => {
  const envio = new Date(2026, 9, 20, 20, 0)
  const ahora = new Date(2026, 9, 20, 21, 30)
  assert.equal(esHoyLocal(envio.toISOString(), ahora), true)
})

test('esHoyLocal: otro día local, fecha inválida o vacía no cuentan', () => {
  const ahora = new Date(2026, 9, 20, 9, 0)
  assert.equal(esHoyLocal(new Date(2026, 9, 19, 23, 59).toISOString(), ahora), false)
  assert.equal(esHoyLocal(new Date(2026, 9, 21, 0, 0).toISOString(), ahora), false)
  assert.equal(esHoyLocal('no-es-fecha', ahora), false)
  assert.equal(esHoyLocal(undefined, ahora), false)
  assert.equal(esHoyLocal(null, ahora), false)
})
