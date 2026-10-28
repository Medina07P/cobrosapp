import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { esReboteActivo, clientesEnRebote, separarPendientesPorRebote } from './rebotes.js'

const cliente = (id, nombre, correo, correo_rebotado = null) => ({ id, nombre, correo, correo_rebotado })
const sub = (id, cliente_id, monto, activa = 1) => ({ id, cliente_id, monto, activa })

test('esReboteActivo: solo cuando la columna coincide con el correo actual', () => {
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'ana@x.com', 'ana@x.com')), true)
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'nueva@x.com', 'ana@x.com')), false)
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'ana@x.com', null)), false)
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'ana@x.com', '')), false)
})

test('esReboteActivo compara igual que el scheduler: distingue mayúsculas', () => {
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'Ana@X.com', 'ana@x.com')), false)
})

test('clientesEnRebote devuelve solo clientes con rebote y suscripción activa', () => {
  const clientes = [
    cliente(1, 'Ana', 'ana@x.com', 'ana@x.com'),
    cliente(2, 'Beto', 'beto@x.com', 'viejo@x.com'),
    cliente(3, 'Caro', 'caro@x.com', 'caro@x.com'),
  ]
  const subs = [sub(10, 1, 50000), sub(11, 3, 30000, 0)]
  assert.deepEqual(clientesEnRebote(clientes, subs), [
    { id: 1, nombre: 'Ana', correo: 'ana@x.com', suscripciones: 1, monto: 50000 },
  ])
})

test('clientesEnRebote suma varias suscripciones activas y ordena por monto', () => {
  const clientes = [
    cliente(1, 'Ana', 'ana@x.com', 'ana@x.com'),
    cliente(2, 'Beto', 'beto@x.com', 'beto@x.com'),
  ]
  const subs = [sub(10, 1, 20000), sub(11, 1, 15000), sub(12, 2, 90000), sub(13, 2, 5000, 0)]
  const r = clientesEnRebote(clientes, subs)
  assert.deepEqual(r.map((x) => [x.id, x.suscripciones, x.monto]), [[2, 1, 90000], [1, 2, 35000]])
})

test('clientesEnRebote no produce NaN con montos nulos', () => {
  const r = clientesEnRebote([cliente(1, 'Ana', 'ana@x.com', 'ana@x.com')], [sub(10, 1, null), sub(11, 1, 10000)])
  assert.equal(r[0].monto, 10000)
})

test('separarPendientesPorRebote aparta los cobros cuyo cliente tiene el correo rebotado', () => {
  const rebotes = [{ id: 2, nombre: 'Beto', correo: 'b@x.com', suscripciones: 1, monto: 5000 }]
  const pendientes = [
    { suscripcion_id: 10, cliente_id: 1, cliente: 'Ana', monto: 1000 },
    { suscripcion_id: 11, cliente_id: 2, cliente: 'Beto', monto: 5000 },
    { suscripcion_id: 12, cliente_id: 3, cliente: 'Caro', monto: 2000 },
  ]
  const r = separarPendientesPorRebote(pendientes, rebotes)
  assert.deepEqual(r.enviables.map((p) => p.suscripcion_id), [10, 12])
  assert.deepEqual(r.rebotados.map((p) => p.suscripcion_id), [11])
})

test('separarPendientesPorRebote sin rebotes deja todo enviable', () => {
  const pendientes = [{ suscripcion_id: 10, cliente_id: 1, cliente: 'Ana', monto: 1000 }]
  const r = separarPendientesPorRebote(pendientes, [])
  assert.equal(r.enviables.length, 1)
  assert.deepEqual(r.rebotados, [])
})

test('PARIDAD: esReboteActivo del frontend es idéntico al del backend', (t) => {
  let backend
  try {
    backend = createRequire(import.meta.url)('../../../backend/rebotes.js')
  } catch {
    t.skip('backend no disponible')
    return
  }
  const correos = ['ana@x.com', 'Ana@X.com', 'ana@x.com ', '', null, undefined, 'a@b.co']
  let comparaciones = 0
  for (const correo of correos) for (const correo_rebotado of correos) {
    const cliente = { correo, correo_rebotado }
    assert.equal(
      esReboteActivo(cliente),
      backend.esReboteActivo(cliente),
      `correo=${JSON.stringify(correo)} rebotado=${JSON.stringify(correo_rebotado)}`
    )
    comparaciones++
  }
  assert.equal(comparaciones, 49)
})
