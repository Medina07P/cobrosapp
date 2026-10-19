const cron = require("node-cron");
const db = require("./db");
const mailer = require("./mailer");
const database = require("./database");
const cobros = require("./cobros");
require("dotenv").config();

let procesandoCobros = false;

function estaProcesandoCobros() {
  return procesandoCobros;
}

// Clientes del usuario por id: evita resolver clientes de otro usuario
function clientesDe(usuarioId) {
  return new Map(db.clientes.all(usuarioId).map((c) => [c.id, c]));
}

/**
 * QUÉ SE ENVIARÍA AHORA PARA UN USUARIO
 * Cobros de hoy sin enviar + vencidos dentro de la ventana de reintento.
 * Ver cobros.planificarCobros para el detalle de cada lista.
 */
function previsualizarCobros(usuarioId, confirmarReenvio = false) {
  return cobros.planificarCobros(
    db.suscripciones.activas(usuarioId),
    db.historial.all(usuarioId),
    cobros.hoyISO(),
    { ventana: cobros.ventanaReintento(), confirmarReenvio }
  );
}

/**
 * RESUMEN PARA LA API: cobros de hoy, vencidos (se reintentan) y perdidos (solo informativos)
 */
function resumenCobros(usuarioId) {
  const plan = previsualizarCobros(usuarioId, false);
  const clientes = clientesDe(usuarioId);
  const detallar = ({ sus, fechaCobro, diasVencido }) => ({
    suscripcion_id: sus.id,
    cliente: clientes.get(sus.cliente_id)?.nombre || "Desconocido",
    plan: sus.tipo,
    monto: sus.monto,
    fechaCobro,
    diasVencido,
  });

  return {
    hoy: cobros.hoyISO(),
    ventanaDias: cobros.ventanaReintento(),
    paraHoy: plan.enviar.filter((i) => i.diasVencido === 0).map(detallar),
    vencidos: plan.enviar.filter((i) => i.diasVencido > 0).map(detallar),
    perdidos: plan.perdidos.map(detallar),
  };
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

// --- FUNCIÓN PRINCIPAL: cobros de hoy + vencidos ---
async function procesarCobrosDelDia(usuarioIdFijo = null, confirmarReenvio = false) {
  if (procesandoCobros) return { success: false, message: "Ejecución en curso" };

  procesandoCobros = true;
  const resumen = { success: true, enviados: 0, vencidosEnviados: 0, omitidos: 0, perdidos: 0 };

  try {
    const usuarios = usuarioIdFijo
      ? [database.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioIdFijo)]
      : database.prepare('SELECT * FROM usuarios').all();

    for (const usuario of usuarios) {
      if (!usuario) continue;

      const plan = previsualizarCobros(usuario.id, confirmarReenvio);
      const clientes = clientesDe(usuario.id);
      resumen.omitidos += plan.yaEnviadosHoy.length;
      resumen.perdidos += plan.perdidos.length;

      for (const { sus, fechaCobro, diasVencido } of plan.enviar) {
        const cliente = clientes.get(sus.cliente_id);
        if (!cliente) continue;

        const sufijo = diasVencido > 0 ? ` (vencido desde ${fechaCobro})` : "";

        try {
          await mailer.enviarCobro({ cliente, suscripcion: sus, usuarioConfig: usuario });

          db.historial.create({
            suscripcion_id: sus.id,
            fecha: new Date().toISOString(),
            estado: "Enviado",
            detalles: `Cobro ${sus.tipo} enviado${sufijo}.`,
            monto: sus.monto
          }, usuario.id);

          resumen.enviados++;
          if (diasVencido > 0) resumen.vencidosEnviados++;
        } catch (err) {
          db.historial.create({
            suscripcion_id: sus.id,
            fecha: new Date().toISOString(),
            estado: "Fallido",
            detalles: `Error${sufijo}: ${err.message}`,
            monto: sus.monto
          }, usuario.id);
        }
      }
    }
    return resumen;
  } finally {
    procesandoCobros = false;
  }
}

function iniciarScheduler() {
  const min = process.env.CRON_MIN || "00";
  const hora = process.env.CRON_HORA || "08";
  const expr = `${min} ${hora} * * *`;

  console.log(`[Scheduler] Programado para las ${hora}:${min} (reintento de vencidos: ${cobros.ventanaReintento()} días)`);

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
  procesarSeleccionados,
  previsualizarCobros,
  resumenCobros
};
