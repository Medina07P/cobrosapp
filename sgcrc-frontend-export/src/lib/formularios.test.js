import { test } from 'node:test'
import assert from 'node:assert/strict'
import { primerInvalido, enfocarPrimerInvalido } from './formularios.js'

const contenedor = (el) => ({ querySelector: (sel) => (sel === '[aria-invalid="true"]' ? el : null) })

test('primerInvalido devuelve el elemento o null y tolera contenedor nulo', () => {
  const el = { focus() {} }
  assert.equal(primerInvalido(contenedor(el)), el)
  assert.equal(primerInvalido(contenedor(null)), null)
  assert.equal(primerInvalido(null), null)
  assert.equal(primerInvalido(undefined), null)
})

test('enfocarPrimerInvalido enfoca y devuelve true; sin inválidos devuelve false', () => {
  let enfocado = 0
  const el = { focus() { enfocado += 1 } }
  assert.equal(enfocarPrimerInvalido(contenedor(el)), true)
  assert.equal(enfocado, 1)
  assert.equal(enfocarPrimerInvalido(contenedor(null)), false)
})
