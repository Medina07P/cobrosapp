// index.js — Punto de entrada del SGCRC Backend

require("dotenv").config();

const { iniciarScheduler }  = require("./scheduler");
const { iniciarAPI }        = require("./api");
const { verificarConexion } = require("./mailer");

const PUERTO = process.env.PORT || 3000;

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  SGCRC — Sistema de Gestión de Cobros     ");
  console.log("═══════════════════════════════════════════");
  if (!process.env.JWT_SECRET) {
    console.warn("⚠️  JWT_SECRET no está definido: se usa una clave por defecto del código. Define JWT_SECRET en .env.");
  }

  // 1. Verificar conexión SMTP
  const smtpOk = await verificarConexion();
  if (!smtpOk && process.env.SMTP_REQUIRED === "true") {
    throw new Error("No fue posible conectar a SMTP (SMTP_REQUIRED=true)");
  }

  // 2. Arrancar el scheduler diario
  iniciarScheduler();

  // 3. Arrancar la API REST
  iniciarAPI(PUERTO);
}

main().catch(err => {
  console.error("Error fatal al iniciar:", err.message);
  process.exit(1);
});
