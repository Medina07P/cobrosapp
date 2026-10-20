import { test } from 'node:test'
import assert from 'node:assert/strict'
import { indexarPorId, enriquecerHistorial, limitarFilas, fechaHistorial, textoRegistros, LIMITE_FILAS } from './historial.js'

test('indexarPorId crea un Map por id y tolera entradas no válidas', () => {
  const m = indexarPorId([{ id: 1, a: 'x' }, { id: 2, a: 'y' }])
  assert.equal(m.get(2).a, 'y')
  assert.equal(indexarPorId(null).size, 0)
})

test('enriquecerHistorial une cliente y suscripción, usa el monto de la suscripción y ordena de más reciente a más antiguo', () => {
  const clientes = [{ id: 10, nombre: 'Ana' }]
  const subs = [{ id: 5, cliente_id: 10, tipo: 'Plan', monto: 500 }]
  const hist = [
    { id: 1, suscripcion_id: 5, fecha: '2026-01-01T10:00:00Z', estado: 'Enviado', monto: 100 },
    { id: 2, suscripcion_id: 5, fecha_envio: '2026-03-01', estado: 'Fallido' },
    { id: 3, suscripcion_id: 99, fecha: 'basura', estado: 'Enviado' },
  ]
  const r = enriquecerHistorial(hist, subs, clientes)
  assert.deepEqual(r.map(h => h.id), [2, 1, 3])
  assert.equal(r[0].cli.nombre, 'Ana')
  assert.equal(r[0].monto_final, 500)
  assert.equal(r[1].monto_final, 100)
  assert.equal(r[2].sus, undefined)
  assert.equal(r[2].monto_final, 0)
  assert.equal(hist[0].id, 1)
})

test('limitarFilas devuelve los primeros N sin mutar', () => {
  const a = Array.from({ length: 250 }, (_, i) => i)
  assert.equal(LIMITE_FILAS, 100)
  assert.equal(limitarFilas(a, 100).length, 100)
  assert.equal(limitarFilas(a, 300).length, 250)
  assert.equal(a.length, 250)
})

test('fechaHistorial: vacío, solo fecha y fecha con hora', () => {
  assert.equal(fechaHistorial(''), '')
  assert.equal(fechaHistorial(undefined), '')
  assert.equal(fechaHistorial('no es fecha'), '')
  assert.equal(fechaHistorial('2026-03-01'), '01/03/2026')
  assert.notEqual(fechaHistorial('2026-03-01T15:30:00Z'), '')
  assert.notEqual(fechaHistorial('2026-03-01T15:30:00Z'), '01/03/2026')
})

test('textoRegistros usa singular solo para 1', () => {
  assert.equal(textoRegistros(0), '0 registros')
  assert.equal(textoRegistros(1), '1 registro')
  assert.equal(textoRegistros(25), '25 registros')
})
