const cron = require("node-cron");
const db = require("./db");
const mailer = require("./mailer");
const database = require("./database"); 
require("dotenv").config();

let procesandoCobros = false;

function estaProcesandoCobros() {
  return procesandoCobros;
}

// NUEVA FUNCIÓN: Lógica de validación por frecuencia
function tocaCobrarHoy(sus, diaActual, diaSemana, diasMes) {
  // Ajuste de seguridad: el día de cobro no puede superar el último día del mes actual
  const diaBase = Math.min(sus.dia_cobro, diasMes);

  switch (sus.frecuencia) {
    case 'quincenal':
      // Cobra el día programado y 15 días después
      const segundaFecha = diaBase + 15;
      const diaAjustado = segundaFecha > diasMes ? segundaFecha - diasMes : segundaFecha;
      return diaActual === diaBase || diaActual === diaAjustado;
    
    case 'semanal':
      // El dia_cobro (1-7) representa el día de la semana
      return diaSemana === (sus.dia_cobro % 7);
      
    case 'anual':
      // Requiere que hoy sea el día base y el mes de cobro coincida
      const hoy = new Date();
      return diaActual === diaBase && hoy.getMonth() === (sus.mes_cobro || 0);

    case 'mensual':
    default:
      return diaActual === diaBase;
  }
}

async function procesarCobrosDelDia(usuarioIdFijo = null) {
  if (procesandoCobros) {
    console.log("⏭️ Cobros omitidos: ya hay una ejecución en curso.");
    return { success: false, message: "Ya hay una ejecución en curso" };
  }

  procesandoCobros = true;
  let totalEnviados = 0;

  try {
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diaSemana = hoy.getDay(); 
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

    console.log(`\n⏰ [${hoy.toLocaleString("es-CO")}] Iniciando ciclo...`);

    let usuarios = [];
    if (usuarioIdFijo) {
      const u = database.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioIdFijo);
      if (u) usuarios.push(u);
    } else {
      usuarios = database.prepare('SELECT * FROM usuarios').all();
    }

    for (const usuario of usuarios) {
      const suscripciones = db.suscripciones.activas(usuario.id);
      
      // FILTRO ACTUALIZADO: Usa la nueva función de lógica de frecuencia
      const paraHoy = suscripciones.filter((s) => 
        tocaCobrarHoy(s, diaActual, diaSemana, diasMes)
      );

      if (paraHoy.length === 0) continue;

      for (const sus of paraHoy) {
        const cliente = db.clientes.find(sus.cliente_id);
        if (!cliente) continue;

        try {
          await mailer.enviarCobro({ 
            cliente, 
            suscripcion: sus, 
            usuarioConfig: usuario 
          });

          // Mantenemos tus correcciones para evitar NaN/Invalid Date
          db.historial.create({
            suscripcion_id: sus.id,
            monto: sus.monto, 
            fecha: new Date().toISOString(), 
            estado: "Enviado",
            detalles: `Cobro ${sus.frecuencia || 'mensual'} enviado con éxito.`
          }, usuario.id);

          totalEnviados++;
          console.log(` ✅ Enviado (${sus.frecuencia || 'mensual'}) → ${cliente.nombre}`);
        } catch (err) {
          db.historial.create({
            suscripcion_id: sus.id,
            monto: sus.monto,
            fecha: new Date().toISOString(),
            estado: "Fallido",
            detalles: `Error: ${err.message}`
          }, usuario.id);
          console.error(` ❌ Fallo → ${cliente.nombre}: ${err.message}`);
        }
      }
    }
    return { success: true, enviados: totalEnviados };
  } finally {
    procesandoCobros = false;
  }
}

function iniciarScheduler() {
  const hora = process.env.CRON_HORA || "08";
  const min = process.env.CRON_MIN || "00";
  const expr = `${min} ${hora} * * *`;

  console.log(`📅 Scheduler activo — se ejecuta a las ${hora}:${min}`);

  cron.schedule(expr, () => procesarCobrosDelDia(), {
    timezone: "America/Bogota",
  });
}

module.exports = { iniciarScheduler, procesarCobrosDelDia, estaProcesandoCobros };