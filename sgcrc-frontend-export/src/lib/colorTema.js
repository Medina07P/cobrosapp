export const COLOR_POR_DEFECTO = '#1F6B4F'
export const TINTA = '#1F2421'
const BLANCO = '#FFFFFF'

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
  const la = luminancia(parseHex(a))
  const lb = luminancia(parseHex(b))
  const [alto, bajo] = la >= lb ? [la, lb] : [lb, la]
  return (alto + 0.05) / (bajo + 0.05)
}

// Texto legible sobre un fondo de marca: el que dé más contraste
export function textoSobre(hex) {
  return ratioContraste(hex, BLANCO) >= ratioContraste(hex, TINTA) ? BLANCO : TINTA
}

export function aplicarColorTema(root, hex) {
  const color = parseHex(hex) ? hex : COLOR_POR_DEFECTO
  const { r, g, b } = parseHex(color)
  root.style.setProperty('--color-primario', color)
  root.style.setProperty('--color-primario-glow', `rgba(${r}, ${g}, ${b}, 0.2)`)
  root.style.setProperty('--color-primario-contraste', textoSobre(color))
  return color
}
