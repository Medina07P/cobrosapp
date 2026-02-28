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

  // 1. Verificar conexión SMTP
  await verificarConexion();

  // 2. Arrancar el scheduler diario
  iniciarScheduler();

  // 3. Arrancar la API REST
  iniciarAPI(PUERTO);
}

main().catch(err => {
  console.error("Error fatal al iniciar:", err.message);
  process.exit(1);
});
