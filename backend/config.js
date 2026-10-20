// config.js — Configuración obligatoria (pura, sin efectos al cargar el módulo)

// Devuelve el secreto JWT leyendo la variable de entorno al momento de la llamada.
function jwtSecret() {
  const valor = process.env.JWT_SECRET;
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error("JWT_SECRET no está definido. Defínelo en backend/.env (una clave larga y aleatoria).");
  }
  return valor;
}

module.exports = { jwtSecret };
