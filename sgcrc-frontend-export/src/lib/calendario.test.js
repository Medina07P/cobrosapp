import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { parseFechaLocal, diasDelMes, rejillaMes, agruparCobrosPorDia, fechaLarga, tocaCobrarEn } from './calendario.js'

test('parseFechaLocal interpreta AAAA-MM-DD como fecha local, no UTC', () => {
  const d = parseFechaLocal('2026-10-05')
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 9)
  assert.equal(d.getDate(), 5)
  assert.equal(d.getHours(), 0)
  assert.equal(parseFechaLocal('2026-10-05T12:00:00Z').getDate(), 5)
})

test('parseFechaLocal devuelve null con entradas no válidas', () => {
  assert.equal(parseFechaLocal(''), null)
  assert.equal(parseFechaLocal(null), null)
  assert.equal(parseFechaLocal('basura'), null)
})

test('diasDelMes: 28, 29, 30 y 31 días', () => {
  assert.equal(diasDelMes(2026, 1), 28)
  assert.equal(diasDelMes(2028, 1), 29)
  assert.equal(diasDelMes(2026, 3), 30)
  assert.equal(diasDelMes(2026, 0), 31)
})

test('rejillaMes: días y desfase del primer día (domingo = 0)', () => {
  assert.deepEqual(rejillaMes(2026, 9), { dias: 31, desfase: 4 }) // 1 oct 2026 es jueves
  assert.deepEqual(rejillaMes(2026, 1), { dias: 28, desfase: 0 }) // 1 feb 2026 es domingo
})

test('fechaLarga formatea en español', () => {
  assert.equal(fechaLarga(2026, 9, 15), '15 de octubre de 2026')
})

const clientes = [{ id: 1, nombre: 'Ana' }]

test('mensual agrupa por día de la fecha de alta y suma montos', () => {
  const subs = [
    { id: 1, cliente_id: 1, monto: 100, frecuencia: 'mensual', fecha_alta: '2026-01-15' },
    { id: 2, cliente_id: 1, monto: 50, frecuencia: 'mensual', fecha_alta: '2026-02-15' },
  ]
  const m = agruparCobrosPorDia(subs, clientes, 2026, 9)
  assert.equal(m[15].total, 150)
  assert.equal(m[15].items.length, 2)
  assert.equal(m[15].items[0].cl.nombre, 'Ana')
})

test('no muestra cobros antes de la fecha de alta (huso local)', () => {
  const subs = [{ id: 1, cliente_id: 1, monto: 10, frecuencia: 'mensual', fecha_alta: '2026-10-15' }]
  assert.equal(agruparCobrosPorDia(subs, clientes, 2026, 8)[15], undefined)
  assert.equal(agruparCobrosPorDia(subs, clientes, 2026, 9)[15].total, 10)
  assert.equal(agruparCobrosPorDia(subs, clientes, 2026, 9)[14], undefined)
})

test('alta el 31 en un mes de 30 días cobra el último día; en febrero, el 28', () => {
  const subs = [{ id: 1, cliente_id: 1, monto: 10, frecuencia: 'mensual', fecha_alta: '2026-01-31' }]
  assert.equal(agruparCobrosPorDia(subs, clientes, 2026, 3)[30].total, 10)
  assert.equal(agruparCobrosPorDia(subs, clientes, 2026, 1)[28].total, 10)
  assert.equal(agruparCobrosPorDia(subs, clientes, 2028, 1)[29].total, 10)
  assert.equal(agruparCobrosPorDia(subs, clientes, 2026, 0)[31].total, 10)
})

test('sin fecha de alta usa dia_cobro', () => {
  const subs = [{ id: 1, cliente_id: 1, monto: 10, dia_cobro: 5 }]
  assert.equal(agruparCobrosPorDia(subs, clientes, 2026, 9)[5].total, 10)
  // sin día ni alta, el backend cobra el día 1
  assert.deepEqual(Object.keys(agruparCobrosPorDia([{ id: 2, monto: 1 }], clientes, 2026, 9)).map(Number), [1])
})

test('semanal sin alta cobra cada semana el día de la semana de (día % 7)', () => {
  const subs = [{ id: 1, cliente_id: 1, monto: 10, frecuencia: 'semanal', dia_cobro: 4 }]
  const m = agruparCobrosPorDia(subs, clientes, 2026, 9) // jueves de octubre 2026: 1, 8, 15, 22, 29
  assert.deepEqual(Object.keys(m).map(Number), [1, 8, 15, 22, 29])
})

test('semanal con alta usa el día de la semana de la alta (y nada antes)', () => {
  const subs = [{ id: 1, cliente_id: 1, monto: 10, frecuencia: 'semanal', fecha_alta: '2026-10-05' }] // lunes
  assert.deepEqual(Object.keys(agruparCobrosPorDia(subs, clientes, 2026, 9)).map(Number), [5, 12, 19, 26])
  assert.deepEqual(agruparCobrosPorDia(subs, clientes, 2026, 8), {})
})

test('quincenal cobra el día base y +15, o -días del mes si no cabe', () => {
  const subs = [{ id: 1, cliente_id: 1, monto: 10, frecuencia: 'quincenal', dia_cobro: 10 }]
  assert.deepEqual(Object.keys(agruparCobrosPorDia(subs, clientes, 2026, 9)).map(Number), [10, 25])
  const s2 = [{ id: 1, cliente_id: 1, monto: 10, frecuencia: 'quincenal', dia_cobro: 15 }]
  assert.deepEqual(Object.keys(agruparCobrosPorDia(s2, clientes, 2026, 1)).map(Number), [2, 15])
  const s3 = [{ id: 1, cliente_id: 1, monto: 10, frecuencia: 'quincenal', dia_cobro: 31 }]
  assert.deepEqual(Object.keys(agruparCobrosPorDia(s3, clientes, 2026, 3)).map(Number), [15, 30])
})

test('anual sin alta cobra en mes_cobro + 1 (índice 0)', () => {
  const subs = [{ id: 1, cliente_id: 1, monto: 10, frecuencia: 'anual', dia_cobro: 3, mes_cobro: 9 }]
  assert.equal(agruparCobrosPorDia(subs, clientes, 2026, 9)[3].total, 10)
  assert.deepEqual(agruparCobrosPorDia(subs, clientes, 2026, 8), {})
})

test('anual con alta usa el mes y el día de la alta', () => {
  const subs = [{ id: 1, cliente_id: 1, monto: 10, frecuencia: 'anual', fecha_alta: '2025-03-12', dia_cobro: 3, mes_cobro: 9 }]
  assert.deepEqual(Object.keys(agruparCobrosPorDia(subs, clientes, 2026, 2)).map(Number), [12])
  assert.deepEqual(agruparCobrosPorDia(subs, clientes, 2026, 9), {})
})

test('PARIDAD: tocaCobrarEn del frontend es idéntica a la del backend', (t) => {
  let backend
  try {
    backend = createRequire(import.meta.url)('../../../backend/cobros.js')
  } catch {
    t.skip('backend no disponible')
    return
  }
  const frecuencias = ['semanal', 'quincenal', 'mensual', 'anual', 'Mensual', undefined]
  const altas = [null, '2024-02-29', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-10', '2025-06-15T10:00:00', '2026-03-31']
  const dias = [1, 15, 28, 31, null]
  const meses = [0, 5, 11, undefined]
  const fechas = []
  for (let t = Date.UTC(2024, 0, 1); t <= Date.UTC(2026, 11, 31); t += 86400000) fechas.push(new Date(t).toISOString().slice(0, 10))
  let comparaciones = 0
  const difs = []
  for (const frecuencia of frecuencias) for (const fecha_alta of altas) for (const dia_cobro of dias) for (const mes_cobro of meses) {
    const sus = { frecuencia, fecha_alta, dia_cobro, mes_cobro }
    for (const iso of fechas) {
      comparaciones++
      if (tocaCobrarEn(sus, iso) !== backend.tocaCobrarEn(sus, iso) && difs.length < 10) difs.push({ sus, iso })
    }
  }
  assert.ok(comparaciones > 500000)
  assert.deepEqual(difs, [])
})
