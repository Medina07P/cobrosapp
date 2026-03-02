// scheduler.js — Cron job diario que procesa los cobros del día

const cron = require("node-cron");
const db = require("./db");
const mailer = require("./mailer");
require("dotenv").config();

let procesandoCobros = false;

function estaProcesandoCobros() {
  return procesandoCobros;
}

// ── Lógica de cobro ────────────────────────────────────────────────────

async function procesarCobrosDelDia() {
  if (procesandoCobros) {
    console.log("⏭️  Cobros omitidos: ya hay una ejecución en curso.");
    return;
  }

  procesandoCobros = true;

  try {
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

    console.log(`\n⏰ [${hoy.toLocaleString("es-CO")}] Procesando cobros del día ${diaActual}...`);

    const suscripciones = db.suscripciones.activas();
    const paraHoy = suscripciones.filter((s) => {
      const diaEfectivo = Math.min(s.dia_cobro, diasMes);
      return diaEfectivo === diaActual;
    });

    if (paraHoy.length === 0) {
      console.log("   Sin cobros programados para hoy.");
      return;
    }

    console.log(`   📋 ${paraHoy.length} cobro(s) a procesar...`);

    for (const sus of paraHoy) {
      const cliente = db.clientes.find(sus.cliente_id);

      if (!cliente) {
        console.warn(`   ⚠️  Cliente ${sus.cliente_id} no encontrado. Suscripción ${sus.id} omitida.`);
        continue;
      }

      try {
        await mailer.enviarCobro({ cliente, suscripcion: sus });

        db.historial.create({
          suscripcion_id: sus.id,
          estado: "Enviado",
          monto: sus.monto,
        });

        console.log(`   ✅ Enviado → ${cliente.nombre} <${cliente.correo}> — ${sus.tipo}`);
      } catch (err) {
        db.historial.create({
          suscripcion_id: sus.id,
          estado: "Fallido",
          monto: sus.monto,
          error: err.message,
        });

        console.error(`   ❌ Fallo  → ${cliente.nombre}: ${err.message}`);
      }
    }

    console.log("   ✔️  Proceso completado.\n");
  } finally {
    procesandoCobros = false;
  }
}

// ── Registro del cron ──────────────────────────────────────────────────

function iniciarScheduler() {
  const hora = process.env.CRON_HORA || "08";
  const min = process.env.CRON_MIN || "00";
  const expr = `${min} ${hora} * * *`;

  console.log(`📅 Scheduler activo — se ejecuta diariamente a las ${hora}:${min}`);

  cron.schedule(expr, procesarCobrosDelDia, {
    timezone: "America/Bogota",
  });
}

module.exports = { iniciarScheduler, procesarCobrosDelDia, estaProcesandoCobros };
