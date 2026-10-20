export const COLOR_POR_DEFECTO = '#1F6B4F'
export const TINTA = '#1F2421'
const BLANCO = '#FFFFFF'
// Superficies sobre las que puede aparecer texto de marca (tokens.css: --surface-page, --surface-alt)
const FONDOS_TEXTO = [BLANCO, '#F6F3EC', '#FBF9F4']
const contrastaSobreFondos = (hex) => FONDOS_TEXTO.every((f) => ratioContraste(hex, f) >= 4.5)

export function parseHex(hex) {
  if (typeof hex !== 'string') return null
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function luminancia({ r, g, b }) {
  const canal = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

export function ratioContraste(a, b) {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return 1 // entrada inválida: sin contraste, nunca lanza
  const la = luminancia(ca)
  const lb = luminancia(cb)
  const [alto, bajo] = la >= lb ? [la, lb] : [lb, la]
  return (alto + 0.05) / (bajo + 0.05)
}

// Texto legible sobre un fondo de marca: el que dé más contraste
export function textoSobre(hex) {
  if (!parseHex(hex)) return BLANCO // como backend/perfil.js
  return ratioContraste(hex, BLANCO) >= ratioContraste(hex, TINTA) ? BLANCO : TINTA
}

// Color de marca usable como texto sobre blanco: el mismo si contrasta >= 4.5, si no la tinta
// (mismo contrato que colorLegibleSobreBlanco de backend/perfil.js)
export function colorLegibleSobreBlanco(hex) {
  if (!parseHex(hex)) return TINTA
  return ratioContraste(hex, BLANCO) >= 4.5 ? hex : TINTA
}

const aHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

// Variante del color de marca apta como texto sobre las superficies de la app (blanco, página y alterno,
// la más exigente es #F6F3EC): lo mezcla con la tinta en pasos del 10 % hasta alcanzar 4.5:1 en todas.
export function colorTextoMarca(hex) {
  const base = parseHex(hex)
  if (!base) return COLOR_POR_DEFECTO
  if (contrastaSobreFondos(hex)) return hex
  const tinta = parseHex(TINTA)
  for (let paso = 1; paso <= 10; paso++) {
    const t = paso / 10
    const mezcla = aHex({
      r: base.r * (1 - t) + tinta.r * t,
      g: base.g * (1 - t) + tinta.g * t,
      b: base.b * (1 - t) + tinta.b * t,
    })
    if (contrastaSobreFondos(mezcla)) return mezcla
  }
  return TINTA
}

export function aplicarColorTema(root, hex) {
  const color = parseHex(hex) ? hex : COLOR_POR_DEFECTO
  const { r, g, b } = parseHex(color)
  root.style.setProperty('--color-primario', color)
  root.style.setProperty('--color-primario-glow', `rgba(${r}, ${g}, ${b}, 0.2)`)
  root.style.setProperty('--color-primario-contraste', textoSobre(color))
  root.style.setProperty('--color-primario-texto', colorTextoMarca(color))
  return color
}
