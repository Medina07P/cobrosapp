// Zona fija (Colombia, UTC-5) para que fmt/fmtFecha den el mismo resultado en cualquier CI.
// Debe fijarse antes de crear cualquier Date.
process.env.TZ = 'America/Bogota'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmt, fmtFecha, diaEnZona, esDelDia } from './formato.js'

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

test('diaEnZona: el día de Bogotá, no el UTC', () => {
  assert.equal(diaEnZona('2026-10-25T03:30:00.000Z'), '2026-10-24') // 22:30 del 24 en Bogotá
  assert.equal(diaEnZona('2026-10-25T05:00:00.000Z'), '2026-10-25') // 00:00 del 25 en Bogotá
})

test('diaEnZona: fecha inválida o vacía -> cadena vacía', () => {
  assert.equal(diaEnZona('no es fecha'), '')
  assert.equal(diaEnZona(''), '')
  assert.equal(diaEnZona(undefined), '')
})

test('esDelDia compara contra el día dado', () => {
  assert.equal(esDelDia('2026-10-25T03:30:00.000Z', '2026-10-24'), true)
  assert.equal(esDelDia('2026-10-25T03:30:00.000Z', '2026-10-25'), false)
})
