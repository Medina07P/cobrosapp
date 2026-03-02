const cron = require("node-cron");
const db = require("./db");
const mailer = require("./mailer");
const database = require("./database"); // Importamos la conexión directa para el barrido
require("dotenv").config();

let procesandoCobros = false;

function estaProcesandoCobros() {
  return procesandoCobros;
}

// ── Lógica de cobro ────────────────────────────────────────────────────

async function procesarCobrosDelDia(usuarioIdFijo = null) {
  if (procesandoCobros) {
    console.log("⏭️  Cobros omitidos: ya hay una ejecución en curso.");
    return;
  }

  procesandoCobros = true;

  try {
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

    console.log(`\n⏰ [${hoy.toLocaleString("es-CO")}] Iniciando ciclo de cobros...`);

    // 1. Obtener los usuarios a procesar
    // Si viene usuarioIdFijo (desde la API /run), procesamos solo uno.
    // Si no (desde el Cron), procesamos a TODOS los usuarios de la DB.
    let usuarios = [];
    if (usuarioIdFijo) {
      const u = database.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioIdFijo);
      if (u) usuarios.push(u);
    } else {
      usuarios = database.prepare('SELECT * FROM usuarios').all();
    }

    for (const usuario of usuarios) {
      console.log(`\n👤 Procesando cuenta: ${usuario.nombre} (${usuario.email})`);

      // 2. Obtener suscripciones activas de ESTE usuario
      const suscripciones = db.suscripciones.activas(usuario.id);
      
      const paraHoy = suscripciones.filter((s) => {
        const diaEfectivo = Math.min(s.dia_cobro, diasMes);
        return diaEfectivo === diaActual;
      });

      if (paraHoy.length === 0) {
        console.log(`   - Sin cobros para hoy.`);
        continue;
      }

      console.log(`   - 📋 ${paraHoy.length} cobros programados...`);

      for (const sus of paraHoy) {
        const cliente = db.clientes.find(sus.cliente_id);
        if (!cliente) continue;

        try {
          // 3. ENVIAR COBRO (Pasamos los datos del usuario para el SMTP)
          // Nota: El mailer.js deberá ser actualizado para recibir 'usuario'
          await mailer.enviarCobro({ 
            cliente, 
            suscripcion: sus, 
            usuarioConfig: usuario 
          });

          db.historial.create({
            suscripcion_id: sus.id,
            estado: "Enviado",
            detalles: `Cobro ${sus.tipo} enviado con éxito.`
          }, usuario.id);

          console.log(`   ✅ Enviado → ${cliente.nombre} — ${sus.tipo}`);
        } catch (err) {
          db.historial.create({
            suscripcion_id: sus.id,
            estado: "Fallido",
            detalles: `Error: ${err.message}`
          }, usuario.id);

          console.error(`   ❌ Fallo  → ${cliente.nombre}: ${err.message}`);
        }
      }
    }

    console.log("\n✔️  Ciclo de cobros completado para todos los usuarios.\n");
  } finally {
    procesandoCobros = false;
  }
}

// ── Registro del cron (Igual que antes) ────────────────────────────────

function iniciarScheduler() {
  const hora = process.env.CRON_HORA || "08";
  const min = process.env.CRON_MIN || "00";
  const expr = `${min} ${hora} * * *`;

  console.log(`📅 Scheduler activo — se ejecuta diariamente a las ${hora}:${min}`);

  cron.schedule(expr, () => procesarCobrosDelDia(), {
    timezone: "America/Bogota",
  });
}

module.exports = { iniciarScheduler, procesarCobrosDelDia, estaProcesandoCobros };