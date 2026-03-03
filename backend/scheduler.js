const cron = require("node-cron");
const db = require("./db");
const mailer = require("./mailer");
const database = require("./database"); 
require("dotenv").config();

let procesandoCobros = false;

function estaProcesandoCobros() {
  return procesandoCobros;
}

function tocaCobrarHoy(sus, diaActual, diaSemana, diasMes) {
  const diaBase = Math.min(sus.dia_cobro, diasMes);
  switch (sus.frecuencia) {
    case 'quincenal':
      const segundaFecha = diaBase + 15;
      const diaAjustado = segundaFecha > diasMes ? segundaFecha - diasMes : segundaFecha;
      return diaActual === diaBase || diaActual === diaAjustado;
    case 'semanal':
      return diaSemana === (sus.dia_cobro % 7);
    case 'anual':
      const hoy = new Date();
      return diaActual === diaBase && hoy.getMonth() === (sus.mes_cobro || 0);
    case 'mensual':
    default:
      return diaActual === diaBase;
  }
}

// --- NUEVA FUNCIÓN: PROCESAR SELECCIÓN INDIVIDUAL ---
async function procesarSeleccionados(usuarioId, listaIds) {
  if (procesandoCobros) return { success: false, message: "Ejecución en curso" };
  
  procesandoCobros = true;
  let totalEnviados = 0;

  try {
    const usuario = database.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
    if (!usuario) throw new Error("Usuario no encontrado");

    for (const susId of listaIds) {
      const sus = db.suscripciones.find(susId);
      const cliente = db.clientes.find(sus.cliente_id);

      if (!sus || !cliente) continue;

      try {
        await mailer.enviarCobro({ cliente, suscripcion: sus, usuarioConfig: usuario });
        
        db.historial.create({
          suscripcion_id: sus.id,
          fecha: new Date().toISOString(), 
          estado: "Enviado",
          detalles: `Reenvío manual: ${sus.frecuencia} de $${sus.monto}.`
        }, usuario.id);

        totalEnviados++;
      } catch (err) {
        console.error(`❌ Error individual → ${cliente.nombre}: ${err.message}`);
      }
    }
    return { success: true, enviados: totalEnviados };
  } finally {
    procesandoCobros = false;
  }
}

// --- FUNCIÓN PRINCIPAL MEJORADA ---
async function procesarCobrosDelDia(usuarioIdFijo = null, confirmarReenvio = false) {
  if (procesandoCobros) return { success: false, message: "Ejecución en curso" };

  procesandoCobros = true;
  let totalEnviados = 0;

  try {
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diaSemana = hoy.getDay(); 
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const hoyISO = hoy.toISOString().split('T')[0];

    let usuarios = usuarioIdFijo 
      ? [database.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioIdFijo)]
      : database.prepare('SELECT * FROM usuarios').all();

    for (const usuario of usuarios) {
      if (!usuario) continue;
      
      const suscripciones = db.suscripciones.activas(usuario.id);
      const paraHoy = suscripciones.filter(s => tocaCobrarHoy(s, diaActual, diaSemana, diasMes));

      const historialHoy = db.historial.all(usuario.id).filter(h => 
        h.fecha.startsWith(hoyISO) && h.estado === 'Enviado'
      );

      for (const sus of paraHoy) {
        const yaFueEnviadoHoy = historialHoy.some(h => h.suscripcion_id === sus.id);

        if (yaFueEnviadoHoy && !confirmarReenvio) continue; 

        const cliente = db.clientes.find(sus.cliente_id);
        if (!cliente) continue;

        try {
          await mailer.enviarCobro({ cliente, suscripcion: sus, usuarioConfig: usuario });

          db.historial.create({
            suscripcion_id: sus.id,
            fecha: new Date().toISOString(), 
            estado: "Enviado",
            detalles: `Cobro ${sus.frecuencia} de $${sus.monto} enviado.`
          }, usuario.id);

          totalEnviados++;
        } catch (err) {
          db.historial.create({
            suscripcion_id: sus.id,
            fecha: new Date().toISOString(),
            estado: "Fallido",
            detalles: `Error: ${err.message}`
          }, usuario.id);
        }
      }
    }
    return { success: true, enviados: totalEnviados };
  } finally {
    procesandoCobros = false;
  }
}

function iniciarScheduler() {
  const min = process.env.CRON_MIN || "00";
  const hora = process.env.CRON_HORA || "08";
  const expr = `${min} ${hora} * * *`;

  console.log(`[Scheduler] Programado para las ${hora}:${min} (America/Bogota)`);

  cron.schedule(expr, async () => {
    console.log(`[${new Date().toLocaleString()}] Ejecutando cobros automáticos...`);
    try {
      await procesarCobrosDelDia(null, false);
      console.log(`[${new Date().toLocaleString()}] Cobros procesados con éxito.`);
    } catch (error) {
      console.error("ERROR en la ejecución del cron:", error.message);
    }
  }, { timezone: "America/Bogota" });
}

module.exports = { 
  iniciarScheduler, 
  procesarCobrosDelDia, 
  estaProcesandoCobros,
  procesarSeleccionados // EXPORTAMOS LA NUEVA FUNCIÓN
};