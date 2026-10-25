import { test } from 'node:test'
import assert from 'node:assert/strict'
import { siguienteFoco } from './focoDialog.js'

const [a, b, c] = ['a', 'b', 'c']

test('sin elementos enfocables no hay a dónde mover el foco', () => {
  assert.equal(siguienteFoco([], null, false), null)
})

test('Tab en el último vuelve al primero', () => {
  assert.equal(siguienteFoco([a, b, c], c, false), a)
})

test('Shift+Tab en el primero salta al último', () => {
  assert.equal(siguienteFoco([a, b, c], a, true), c)
})

test('en posiciones intermedias deja actuar al navegador', () => {
  assert.equal(siguienteFoco([a, b, c], b, false), null)
  assert.equal(siguienteFoco([a, b, c], b, true), null)
})

test('si el foco está fuera de la lista (p. ej. en el contenedor) entra por el extremo correcto', () => {
  assert.equal(siguienteFoco([a, b, c], 'contenedor', false), a)
  assert.equal(siguienteFoco([a, b, c], 'contenedor', true), c)
})

test('con un solo elemento el foco se queda en él', () => {
  assert.equal(siguienteFoco([a], a, false), a)
  assert.equal(siguienteFoco([a], a, true), a)
})
