import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estadoContrasteCorreo } from './contrasteCorreo.js'
import { TINTA, ratioContraste } from './colorTema.js'

test('amarillo: texto de tinta en el botón y monto en tinta, contraste suficiente', () => {
  const e = estadoContrasteCorreo('#FFD400')
  assert.equal(e.textoBoton, TINTA)
  assert.equal(e.colorMonto, TINTA)
  assert.equal(e.suficiente, true)
  assert.ok(e.ratio >= 4.5)
})

test('verde por defecto: botón blanco y monto del mismo color', () => {
  const e = estadoContrasteCorreo('#1F6B4F')
  assert.equal(e.textoBoton, '#FFFFFF')
  assert.equal(e.colorMonto, '#1F6B4F')
  assert.equal(e.suficiente, true)
})

test('gris medio: el mejor texto no llega a 4.5 y se marca insuficiente', () => {
  const e = estadoContrasteCorreo('#808080')
  assert.equal(e.suficiente, false)
  assert.ok(e.ratio < 4.5)
})

test('entrada inválida usa el color por defecto', () => {
  const e = estadoContrasteCorreo('azul')
  assert.equal(e.textoBoton, '#FFFFFF')
  assert.equal(e.colorMonto, '#1F6B4F')
  assert.equal(e.suficiente, true)
})

test('verde medio: botón blanco pero monto en tinta (blanco < 4.5 y blanco >= tinta)', () => {
  const color = '#2E8B57'
  const blanco = ratioContraste(color, '#FFFFFF')
  assert.ok(blanco < 4.5 && blanco >= ratioContraste(color, TINTA), 'premisa del caso')
  const e = estadoContrasteCorreo(color)
  assert.equal(e.textoBoton, '#FFFFFF')
  assert.equal(e.colorMonto, TINTA)
  assert.notEqual(e.colorMonto, color)
  assert.equal(e.suficiente, false)
})

test('gris medio: el monto también cae a tinta', () => {
  assert.equal(estadoContrasteCorreo('#808080').colorMonto, TINTA)
})
