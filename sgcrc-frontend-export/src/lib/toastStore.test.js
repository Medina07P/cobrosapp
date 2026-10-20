import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearTostadas } from './toastStore.js'

// Programador falso: guarda los callbacks para dispararlos a mano
function falsos() {
  const tareas = new Map()
  let n = 0
  return {
    tareas,
    programar: (fn, ms) => { n += 1; tareas.set(n, { fn, ms }); return n },
    cancelar: (id) => { tareas.delete(id) },
  }
}

test('mostrar agrega la notificación con id y tipo, y notifica', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  let avisos = 0
  t.subscribe(() => { avisos += 1 })
  const id = t.mostrar('Listo', 'ok')
  assert.deepEqual(t.getSnapshot(), [{ id, mensaje: 'Listo', tipo: 'ok' }])
  assert.equal(avisos, 1)
})

test('tipo por defecto es info y getSnapshot es estable sin cambios', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  t.mostrar('Hola')
  assert.equal(t.getSnapshot()[0].tipo, 'info')
  assert.equal(t.getSnapshot(), t.getSnapshot())
})

test('cerrar quita la notificación, cancela su temporizador y notifica una sola vez', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  const id = t.mostrar('A')
  let avisos = 0
  t.subscribe(() => { avisos += 1 })
  t.cerrar(id)
  assert.deepEqual(t.getSnapshot(), [])
  assert.equal(f.tareas.size, 0)
  assert.equal(avisos, 1)
  t.cerrar(id)
  assert.equal(avisos, 1)
})

test('se cierra sola al vencer el temporizador; los errores duran el doble', () => {
  const f = falsos()
  const t = crearTostadas({ duracion: 1000, programar: f.programar, cancelar: f.cancelar })
  t.mostrar('ok', 'ok')
  t.mostrar('mal', 'error')
  const duraciones = [...f.tareas.values()].map((x) => x.ms)
  assert.deepEqual(duraciones, [1000, 2000])
  ;[...f.tareas.values()][0].fn()
  assert.deepEqual(t.getSnapshot().map((x) => x.mensaje), ['mal'])
})

test('máximo 4 visibles: al exceder se cierra la más antigua', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  for (const m of ['1', '2', '3', '4', '5']) t.mostrar(m)
  assert.deepEqual(t.getSnapshot().map((x) => x.mensaje), ['2', '3', '4', '5'])
  assert.equal(f.tareas.size, 4)
})

test('subscribe devuelve una función que da de baja al oyente', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  let avisos = 0
  const baja = t.subscribe(() => { avisos += 1 })
  baja()
  t.mostrar('x')
  assert.equal(avisos, 0)
})

test('la duración por defecto es 5000 ms y la de error 10000 ms', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  t.mostrar('a', 'info')
  t.mostrar('b', 'error')
  assert.deepEqual([...f.tareas.values()].map((x) => x.ms), [5000, 10000])
})

test('pausar cancela los temporizadores y reanudar los reprograma sin cerrar nada', () => {
  const f = falsos()
  const t = crearTostadas({ duracion: 1000, programar: f.programar, cancelar: f.cancelar })
  t.mostrar('a')
  t.mostrar('b', 'error')
  t.pausar()
  assert.equal(f.tareas.size, 0)
  assert.equal(t.getSnapshot().length, 2)
  t.reanudar()
  assert.deepEqual([...f.tareas.values()].map((x) => x.ms), [1000, 2000])
  t.reanudar()
  assert.equal(f.tareas.size, 2)
})
