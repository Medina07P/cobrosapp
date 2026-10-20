// perfil.js — Validación pura de los datos de perfil del usuario.

const COLOR = /^#[0-9a-fA-F]{6}$/;

function colorValido(valor) {
  return typeof valor === 'string' && COLOR.test(valor);
}

// '+57 300 123-4567' → '573001234567'; ''/null → null (sin WhatsApp); inválido → undefined
function normalizarWhatsapp(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const digitos = String(valor).replace(/[\s+\-().]/g, '');
  return /^\d{8,15}$/.test(digitos) ? digitos : undefined;
}

// Contraste WCAG (mismo algoritmo que sgcrc-frontend-export/src/lib/colorTema.js)
const BLANCO = '#FFFFFF';
const TINTA = '#1F2421';

function rgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function luminancia({ r, g, b }) {
  const canal = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

// Ratio de contraste entre dos #RRGGBB (1 a 21)
function ratioContraste(a, b) {
  const la = luminancia(rgb(a));
  const lb = luminancia(rgb(b));
  const [alto, bajo] = la >= lb ? [la, lb] : [lb, la];
  return (alto + 0.05) / (bajo + 0.05);
}

// Texto legible sobre un fondo de marca: blanco o tinta, el de mayor contraste
function textoSobre(hex) {
  if (!colorValido(hex)) return BLANCO;
  return ratioContraste(hex, BLANCO) >= ratioContraste(hex, TINTA) ? BLANCO : TINTA;
}

// Color de marca usable como texto sobre blanco: el mismo si contrasta >= 4.5, si no la tinta
function colorLegibleSobreBlanco(hex) {
  if (!colorValido(hex)) return TINTA;
  return ratioContraste(hex, BLANCO) >= 4.5 ? hex : TINTA;
}

module.exports = { colorValido, normalizarWhatsapp, ratioContraste, textoSobre, colorLegibleSobreBlanco };
