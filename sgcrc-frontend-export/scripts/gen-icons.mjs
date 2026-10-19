// Genera src/ui/icons.generated.js con solo los iconos Phosphor (peso regular) que usa la app.
// Para agregar uno: añadir su nombre a ICONOS y ejecutar `npm run icons`.
import { readFileSync, writeFileSync } from 'node:fs'

const ICONOS = [
  'squares-four', 'users', 'tag', 'arrows-clockwise', 'clock-counter-clockwise',
  'calendar-blank', 'gear', 'warning-circle', 'warning', 'check-circle', 'check',
  'x', 'x-circle', 'arrow-clockwise', 'caret-left', 'caret-right', 'caret-down',
  'paper-plane-tilt', 'envelope-simple', 'coins', 'bell', 'sign-out',
  'magnifying-glass', 'plus', 'pencil-simple', 'trash', 'eye', 'eye-slash', 'list',
]

const base = new URL('../node_modules/@phosphor-icons/core/assets/regular/', import.meta.url)
const salida = new URL('../src/ui/icons.generated.js', import.meta.url)

const lineas = ICONOS.map((nombre) => {
  const svg = readFileSync(new URL(`${nombre}.svg`, base), 'utf8')
  const m = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)
  if (!m) throw new Error(`SVG inválido: ${nombre}`)
  return `  ${JSON.stringify(nombre)}: ${JSON.stringify(m[1].trim())},`
})

const contenido = `// GENERADO por scripts/gen-icons.mjs a partir de @phosphor-icons/core. No editar a mano.
export const ICONOS = {
${lineas.join('\n')}
}
`
writeFileSync(salida, contenido)
console.log(`${ICONOS.length} iconos escritos en src/ui/icons.generated.js`)
