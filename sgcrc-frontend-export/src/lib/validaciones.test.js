import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarCliente, validarPlan, validarSuscripcion, validarPerfil } from './validaciones.js'

test('cliente válido no produce errores', () => {
  assert.deepEqual(validarCliente({ nombre: 'Ana', correo: 'ana@correo.co' }), {})
})

test('cliente: nombre vacío o solo espacios, nombre largo, correo sin @ o vacío', () => {
  assert.equal(validarCliente({ nombre: '  ', correo: 'a@b.c' }).nombre, 'Escribe el nombre.')
  assert.match(validarCliente({ nombre: 'x'.repeat(121), correo: 'a@b.c' }).nombre, /120/)
  assert.equal(validarCliente({ nombre: 'Ana', correo: '' }).correo, 'Escribe el correo.')
  assert.equal(validarCliente({ nombre: 'Ana', correo: 'ana.correo' }).correo, 'El correo no es válido.')
  assert.match(validarCliente({ nombre: 'Ana', correo: 'a@' + 'x'.repeat(260) }).correo, /254/)
})

test('plan válido (monto 0 permitido, string numérica)', () => {
  assert.deepEqual(validarPlan({ nombre_plan: 'Oro', monto: '50000', frecuencia: 'mensual', dia_cobro: '15' }), {})
  assert.deepEqual(validarPlan({ nombre_plan: 'Gratis', monto: 0, frecuencia: 'anual', dia_cobro: 1 }), {})
})

test('plan: nombre, monto, frecuencia y día inválidos', () => {
  const e = validarPlan({ nombre_plan: '', monto: '-5', frecuencia: 'diaria', dia_cobro: '32' })
  assert.equal(e.nombre_plan, 'Escribe el nombre del plan.')
  assert.equal(e.monto, 'El precio debe ser un número sin signos ni letras.')
  assert.equal(e.frecuencia, 'Elige una frecuencia válida.')
  assert.equal(e.dia_cobro, 'El día de cobro debe ser un entero entre 1 y 31.')
  assert.equal(validarPlan({ nombre_plan: 'A', monto: '', frecuencia: 'mensual', dia_cobro: 1 }).monto, 'Escribe el precio.')
  assert.equal(validarPlan({ nombre_plan: 'A', monto: 10, frecuencia: 'mensual', dia_cobro: '1.5' }).dia_cobro, 'El día de cobro debe ser un entero entre 1 y 31.')
})

test('suscripción: cliente, plan y fecha', () => {
  assert.deepEqual(validarSuscripcion({ cliente_id: '3', plan_id: '2', fecha_alta: '2026-10-05' }), {})
  const e = validarSuscripcion({ cliente_id: '', plan_id: '', fecha_alta: '05/10/2026' })
  assert.equal(e.cliente_id, 'Elige un cliente.')
  assert.equal(e.plan_id, 'Elige un plan.')
  assert.equal(e.fecha_alta, 'La fecha de inicio no es válida.')
  assert.deepEqual(validarSuscripcion({ cliente_id: 1, plan_id: 1, fecha_alta: '' }), {})
})

test('perfil: nombre obligatorio y WhatsApp vacío o 8-15 dígitos', () => {
  assert.deepEqual(validarPerfil({ nombre: 'Mi negocio', whatsapp: '' }), {})
  assert.deepEqual(validarPerfil({ nombre: 'Mi negocio', whatsapp: '573001234567' }), {})
  assert.equal(validarPerfil({ nombre: ' ', whatsapp: '' }).nombre, 'Escribe el nombre de tu negocio.')
  assert.equal(validarPerfil({ nombre: 'X', whatsapp: '+57 300' }).whatsapp, 'Escribe solo dígitos, con código de país (8 a 15).')
  assert.equal(validarPerfil({ nombre: 'X', whatsapp: '1234567' }).whatsapp, 'Escribe solo dígitos, con código de país (8 a 15).')
})

test('perfil: el nombre no puede superar 120 caracteres tras recortar', () => {
  assert.deepEqual(validarPerfil({ nombre: 'x'.repeat(120), whatsapp: '' }), {})
  assert.equal(validarPerfil({ nombre: '  ' + 'x'.repeat(121) + '  ', whatsapp: '' }).nombre, 'El nombre no puede superar 120 caracteres.')
})

test('perfil: whatsapp llega como número y se valida igual', () => {
  assert.deepEqual(validarPerfil({ nombre: 'Mi negocio', whatsapp: 573001234567 }), {})
  assert.equal(validarPerfil({ nombre: 'Mi negocio', whatsapp: 1234567 }).whatsapp, 'Escribe solo dígitos, con código de país (8 a 15).')
})

test('límites de cliente: nombre de 120 válido y 121 inválido; correo de 254 válido y 255 inválido', () => {
  assert.deepEqual(validarCliente({ nombre: 'x'.repeat(120), correo: 'a@b.c' }), {})
  assert.equal(validarCliente({ nombre: 'x'.repeat(121), correo: 'a@b.c' }).nombre, 'El nombre no puede superar 120 caracteres.')
  assert.deepEqual(validarCliente({ nombre: 'Ana', correo: 'a@' + 'x'.repeat(252) }), {})
  assert.equal(validarCliente({ nombre: 'Ana', correo: 'a@' + 'x'.repeat(253) }).correo, 'El correo no puede superar 254 caracteres.')
})

test('límites de WhatsApp: 8 y 15 dígitos válidos; 7 y 16 inválidos', () => {
  assert.deepEqual(validarPerfil({ nombre: 'X', whatsapp: '12345678' }), {})
  assert.deepEqual(validarPerfil({ nombre: 'X', whatsapp: '123456789012345' }), {})
  assert.ok(validarPerfil({ nombre: 'X', whatsapp: '1234567' }).whatsapp)
  assert.ok(validarPerfil({ nombre: 'X', whatsapp: '1234567890123456' }).whatsapp)
})

test('límites de plan: día de cobro 0 inválido, 31 válido, texto inválido; montos decimales', () => {
  const base = { nombre_plan: 'Oro', frecuencia: 'mensual' }
  assert.ok(validarPlan({ ...base, monto: 10, dia_cobro: 0 }).dia_cobro)
  assert.deepEqual(validarPlan({ ...base, monto: 10, dia_cobro: 31 }), {})
  assert.ok(validarPlan({ ...base, monto: 10, dia_cobro: 'abc' }).dia_cobro)
  assert.deepEqual(validarPlan({ ...base, monto: '10.5', dia_cobro: 1 }), {})
  assert.ok(validarPlan({ ...base, monto: '10.', dia_cobro: 1 }).monto)
  assert.ok(validarPlan({ ...base, monto: '1,5', dia_cobro: 1 }).monto)
  assert.ok(validarPlan({ ...base, monto: '.5', dia_cobro: 1 }).monto)
})

test('límites de plan: frecuencia undefined es inválida', () => {
  assert.ok(validarPlan({ nombre_plan: 'Oro', monto: 10, frecuencia: undefined, dia_cobro: 1 }).frecuencia)
})
