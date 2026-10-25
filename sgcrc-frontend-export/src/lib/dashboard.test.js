import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aISOLocal, sumarDiasISO, proximosCobros, textoDias } from './dashboard.js'

test('aISOLocal usa componentes locales con ceros a la izquierda', () => {
  assert.equal(aISOLocal(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
  assert.equal(aISOLocal(new Date(2026, 11, 31, 0, 0)), '2026-12-31')
})

test('sumarDiasISO cruza meses y años', () => {
  assert.equal(sumarDiasISO('2026-10-24', 10), '2026-11-03')
  assert.equal(sumarDiasISO('2026-12-31', 1), '2027-01-01')
  assert.equal(sumarDiasISO('2026-03-01', -1), '2026-02-28')
  assert.equal(sumarDiasISO('2026-10-24', 0), '2026-10-24')
})

test('textoDias', () => {
  assert.equal(textoDias(0), 'Hoy')
  assert.equal(textoDias(1), 'Mañana')
  assert.equal(textoDias(5), 'En 5 días')
})

const clientes = [{ id: 1, nombre: 'Ana' }, { id: 2, nombre: 'Beto' }]
const mensual = (id, cliente_id, dia, extra = {}) => ({
  id, cliente_id, activa: 1, monto: 50000, tipo: 'Plan A', frecuencia: 'mensual',
  fecha_alta: `2026-01-${String(dia).padStart(2, '0')}`, ...extra,
})

test('proximosCobros: mensual futuro, hoy y orden por días', () => {
  const subs = [mensual(10, 2, 15), mensual(11, 1, 12)]
  const r = proximosCobros(subs, clientes, '2026-10-12')
  assert.deepEqual(r.map((x) => [x.id, x.fecha, x.dias]), [[11, '2026-10-12', 0], [10, '2026-10-15', 3]])
  assert.equal(r[0].cliente, 'Ana')
  assert.equal(r[0].plan, 'Plan A')
  assert.equal(r[0].monto, 50000)
})

test('proximosCobros: una fila por suscripción aunque sea semanal', () => {
  const sem = mensual(20, 1, 5, { frecuencia: 'semanal', fecha_alta: '2026-10-05' }) // lunes
  const r = proximosCobros([sem], clientes, '2026-10-24', { max: 5 })
  assert.equal(r.length, 1)
  assert.equal(r[0].fecha, '2026-10-26')
  assert.equal(r[0].dias, 2)
  assert.equal(r[0].frecuencia, 'semanal')
})

test('proximosCobros: excluye inactivas y respeta max y ventana', () => {
  const subs = [mensual(1, 1, 20, { activa: 0 }), mensual(2, 1, 21), mensual(3, 1, 22), mensual(4, 1, 23)]
  assert.deepEqual(proximosCobros(subs, clientes, '2026-10-19', { max: 2 }).map((x) => x.id), [2, 3])
  assert.deepEqual(proximosCobros([mensual(5, 1, 15, { frecuencia: 'anual', fecha_alta: '2026-03-15' })], clientes, '2026-10-19', { ventana: 60 }), [])
})

test('proximosCobros: cliente inexistente y suscripción que aún no empieza', () => {
  const futura = mensual(7, 99, 3, { fecha_alta: '2026-12-03' })
  const r = proximosCobros([futura], clientes, '2026-10-24', { ventana: 60 })
  assert.equal(r.length, 1)
  assert.equal(r[0].fecha, '2026-12-03')
  assert.equal(r[0].cliente, 'Cliente eliminado')
})

test('proximosCobros: alta el día 31 cae en el último día de un mes corto', () => {
  const r = proximosCobros([mensual(30, 1, 31)], clientes, '2026-11-25')
  assert.equal(r.length, 1)
  assert.equal(r[0].fecha, '2026-11-30')
  assert.equal(r[0].dias, 5)
})

test('proximosCobros: quincenal toma el día base y el día base + 15', () => {
  const q = mensual(31, 1, 10, { frecuencia: 'quincenal' })
  const r = proximosCobros([q], clientes, '2026-10-11')
  assert.equal(r.length, 1)
  assert.equal(r[0].fecha, '2026-10-25')
  assert.equal(r[0].dias, 14)
})
