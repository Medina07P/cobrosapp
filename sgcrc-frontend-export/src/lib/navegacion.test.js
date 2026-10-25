import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NAV, IDS_BARRA_MOVIL, particionarNav, vistaEnMas } from './navegacion.js'

test('NAV conserva los 7 destinos con id, label e icon', () => {
  assert.equal(NAV.length, 7)
  for (const n of NAV) {
    assert.ok(n.id && n.label && n.icon, `destino incompleto: ${JSON.stringify(n)}`)
  }
})

test('particionarNav: la barra tiene 4 destinos fijos y el resto va a "Más"', () => {
  const { barra, mas } = particionarNav()
  assert.deepEqual(barra.map((n) => n.id), IDS_BARRA_MOVIL)
  assert.deepEqual(mas.map((n) => n.id), ['planes', 'historial', 'configuracion'])
  assert.equal(barra.length + mas.length, NAV.length)
})

test('particionarNav no pierde ni duplica destinos', () => {
  const { barra, mas } = particionarNav()
  const ids = [...barra, ...mas].map((n) => n.id).sort()
  assert.deepEqual(ids, NAV.map((n) => n.id).sort())
})

test('vistaEnMas distingue vistas de la barra y de "Más"', () => {
  assert.equal(vistaEnMas('dashboard'), false)
  assert.equal(vistaEnMas('calendario'), false)
  assert.equal(vistaEnMas('planes'), true)
  assert.equal(vistaEnMas('configuracion'), true)
  assert.equal(vistaEnMas('inexistente'), false)
})
