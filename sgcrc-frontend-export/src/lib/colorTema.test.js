import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  COLOR_POR_DEFECTO, TINTA, parseHex, ratioContraste, textoSobre, aplicarColorTema,
} from './colorTema.js'

test('parseHex acepta 6 y 3 dígitos y rechaza basura', () => {
  assert.deepEqual(parseHex('#1F6B4F'), { r: 31, g: 107, b: 79 })
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 })
  assert.equal(parseHex('azul'), null)
  assert.equal(parseHex('#12345'), null)
  assert.equal(parseHex(undefined), null)
})

test('textoSobre elige blanco sobre oscuros y tinta sobre claros', () => {
  assert.equal(textoSobre('#1F6B4F'), '#FFFFFF')
  assert.equal(textoSobre('#4f46e5'), '#FFFFFF')
  assert.equal(textoSobre('#FFD400'), TINTA)
  assert.equal(textoSobre('#ffffff'), TINTA)
})

test('aplicarColorTema fija las tres variables', () => {
  const m = {}
  const root = { style: { setProperty: (k, v) => { m[k] = v } } }
  const usado = aplicarColorTema(root, '#1F6B4F')
  assert.equal(usado, '#1F6B4F')
  assert.equal(m['--color-primario'], '#1F6B4F')
  assert.equal(m['--color-primario-glow'], 'rgba(31, 107, 79, 0.2)')
  assert.equal(m['--color-primario-contraste'], '#FFFFFF')
})

test('aplicarColorTema acepta hex corto y cae al valor por defecto si es inválido', () => {
  const m = {}
  const root = { style: { setProperty: (k, v) => { m[k] = v } } }
  aplicarColorTema(root, '#fff')
  assert.equal(m['--color-primario-glow'], 'rgba(255, 255, 255, 0.2)')
  assert.equal(m['--color-primario-contraste'], TINTA)
  assert.equal(aplicarColorTema(root, 'rojo'), COLOR_POR_DEFECTO)
  assert.equal(m['--color-primario'], COLOR_POR_DEFECTO)
})

test('los tokens de tokens.css cumplen WCAG AA (4.5:1) en sus pares de uso', () => {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')
  const t = {}
  for (const [, k, v] of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) t[k] = v
  const pares = [
    ['ink', 'surface-page'], ['ink-2', 'surface-page'], ['ink-2', 'surface'],
    ['ok', 'ok-bg'], ['warn', 'warn-bg'], ['bad', 'bad-bg'], ['info', 'info-bg'],
    ['ok', 'surface'], ['bad', 'surface'],
  ]
  for (const [a, b] of pares) {
    const r = ratioContraste(t[a], t[b])
    assert.ok(r >= 4.5, `--${a} sobre --${b}: ${r.toFixed(2)}:1 (< 4.5)`)
  }
  assert.ok(ratioContraste('#FFFFFF', t['color-primario']) >= 4.5, 'blanco sobre el acento por defecto')
})
