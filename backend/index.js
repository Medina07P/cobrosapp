// index.js — Punto de entrada del SGCRC Backend

require("dotenv").config();

const { iniciarScheduler }  = require("./scheduler");
const { iniciarAPI }        = require("./api");
const { verificarConexion } = require("./mailer");
const { jwtSecret }         = require("./config");

const PUERTO = process.env.PORT || 3000;

async function main() {
  // JWT_SECRET es obligatorio: si falta, lanza y el proceso termina con código 1
  if (jwtSecret().length < 32) {
    console.warn("JWT_SECRET es corta: usa al menos 32 caracteres");
  }
  console.log("═══════════════════════════════════════════");
  console.log("  SGCRC — Sistema de Gestión de Cobros     ");
  console.log("═══════════════════════════════════════════");

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
