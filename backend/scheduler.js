const cron = require("node-cron");
const db = require("./db");
const mailer = require("./mailer");
const database = require("./database"); 
require("dotenv").config();

let procesandoCobros = false;

function estaProcesandoCobros() {
  return procesandoCobros;
}

/**
 * DETERMINA SI TOCA COBRAR HOY
 * Prioriza el día de la fecha_alta si existe.
 */
/**
 * DETERMINA SI TOCA COBRAR HOY
 */
function tocaCobrarHoy(sus, diaActual, diaSemana, diasMes) {
  const hoy = new Date();
  const hoyISO = hoy.toISOString().split('T')[0];
  
  // 1. VERIFICAR SI LA SUSCRIPCIÓN COMENZÓ
  if (sus.fecha_alta) {
    if (sus.fecha_alta > hoyISO) return false; // Es una fecha futura
    
    // CASO ESPECIAL: Si la fecha de alta es HOY, se cobra sí o sí
    if (sus.fecha_alta === hoyISO) return true;
  }

  // 2. DETERMINAR EL DÍA BASE DE COBRO
  // Si tiene fecha_alta, el día de esa fecha manda. Si no, el día del plan.
  let diaBaseReal = 1;
  if (sus.fecha_alta) {
    diaBaseReal = parseInt(sus.fecha_alta.split('-')[2]);
  } else {
    diaBaseReal = sus.dia_cobro || 1;
  }

  const diaBase = Math.min(diaBaseReal, diasMes);

  // 3. LÓGICA POR FRECUENCIA
  switch (sus.frecuencia?.toLowerCase()) {
    case 'quincenal':
      const segundaFecha = diaBase + 15;
      const diaAjustado = segundaFecha > diasMes ? segundaFecha - diasMes : segundaFecha;
      return diaActual === diaBase || diaActual === diaAjustado;

    case 'semanal':
      let diaSemanaObjetivo = sus.dia_cobro % 7;
      if (sus.fecha_alta) {
        // Obtenemos el día de la semana (0-6) de la fecha de alta
        diaSemanaObjetivo = new Date(sus.fecha_alta + "T00:00:00").getDay();
      }
      return diaSemana === diaSemanaObjetivo;

    case 'anual':
      let mesObjetivo = sus.mes_cobro || 0;
      if (sus.fecha_alta) {
        mesObjetivo = new Date(sus.fecha_alta + "T00:00:00").getMonth();
      }
      return diaActual === diaBase && hoy.getMonth() === mesObjetivo;

    case 'mensual':
    default:
      return diaActual === diaBase;
  }
}

// --- PROCESAR SELECCIÓN INDIVIDUAL (Se mantiene igual) ---
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
          detalles: `Reenvío manual: Plan ${sus.tipo} ($${sus.monto}).`,
          monto: sus.monto
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

// --- FUNCIÓN PRINCIPAL (CORREGIDA PARA USAR FECHA_ALTA) ---
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
      
      // Aquí está el cambio: tocaCobrarHoy ahora detecta la fecha_alta
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
            detalles: `Cobro ${sus.tipo} enviado.`,
            monto: sus.monto 
          }, usuario.id);

          totalEnviados++;
        } catch (err) {
          db.historial.create({
            suscripcion_id: sus.id,
            fecha: new Date().toISOString(),
            estado: "Fallido",
            detalles: `Error: ${err.message}`,
            monto: sus.monto 
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

  console.log(`[Scheduler] Programado para las ${hora}:${min}`);

  cron.schedule(expr, async () => {
    try {
      await procesarCobrosDelDia(null, false);
    } catch (error) {
      console.error("ERROR en cron:", error.message);
    }
  }, { timezone: "America/Bogota" });
}

module.exports = { 
  iniciarScheduler, 
  procesarCobrosDelDia, 
  estaProcesandoCobros,
  procesarSeleccionados 
};