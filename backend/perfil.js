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

module.exports = { colorValido, normalizarWhatsapp };
