import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { ratioContraste, textoSobre, colorLegibleSobreBlanco } from './colorTema.js'

// Solo #RRGGBB: el frontend también acepta #RGB y el backend no; esa diferencia es intencional y no se prueba.
test('PARIDAD: colores del frontend idénticos a backend/perfil.js', (t) => {
  let b
  try {
    b = createRequire(import.meta.url)('../../../backend/perfil.js')
  } catch {
    t.skip('backend no disponible')
    return
  }
  const colores = ['#000000', '#FFFFFF', '#FFD400', '#1F6B4F', '#4F46E5', '#808080']
  const hex = (v) => v.toString(16).padStart(2, '0').toUpperCase()
  for (let r = 0; r <= 255; r += 0x11) for (let g = 0; g <= 255; g += 0x11) for (let bl = 0; bl <= 255; bl += 0x11) colores.push(`#${hex(r)}${hex(g)}${hex(bl)}`)
  const difs = []
  for (const c of colores) {
    for (const otro of ['#FFFFFF', '#1F2421']) {
      if (Math.abs(ratioContraste(c, otro) - b.ratioContraste(c, otro)) > 1e-9) difs.push(['ratio', c, otro])
    }
    if (textoSobre(c) !== b.textoSobre(c)) difs.push(['textoSobre', c])
    if (colorLegibleSobreBlanco(c) !== b.colorLegibleSobreBlanco(c)) difs.push(['legible', c])
  }
  assert.ok(colores.length >= 4096)
  assert.deepEqual(difs.slice(0, 10), [])
})
