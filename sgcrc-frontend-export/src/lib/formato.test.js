import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmt, fmtFecha } from './formato.js'

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
