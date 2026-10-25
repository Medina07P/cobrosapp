import { COLOR_POR_DEFECTO, parseHex, ratioContraste, textoSobre, colorLegibleSobreBlanco } from './colorTema.js'

// Regla real del correo (backend/mailer.js): el botón lleva textoSobre(color) y el monto
// usa colorLegibleSobreBlanco(color). El contraste que importa es el del texto del botón.
export function estadoContrasteCorreo(hex) {
  const color = parseHex(hex) ? hex : COLOR_POR_DEFECTO
  const textoBoton = textoSobre(color)
  const ratio = ratioContraste(color, textoBoton)
  return { ratio, suficiente: ratio >= 4.5, textoBoton, colorMonto: colorLegibleSobreBlanco(color) }
}
