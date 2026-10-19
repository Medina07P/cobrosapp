// cobros.js — Reglas de fechas de cobro (puras: sin base de datos ni reloj implícito).
// Todas las fechas son strings 'YYYY-MM-DD' en la zona horaria de la aplicación
// (America/Bogota por defecto), así el resultado no depende de la zona del servidor.

const ZONA = process.env.APP_TZ || 'America/Bogota';
const VENTANA_BUSQUEDA_DIAS = 30;
const VENTANA_REINTENTO_POR_DEFECTO = 7;

const formatoFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
});

// Fecha 'YYYY-MM-DD' de un instante, en la zona de la aplicación
function aISO(instante) {
  return formatoFecha.format(instante);
}

function hoyISO(ahora = new Date()) {
  return aISO(ahora);
}

function partes(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return {
    y, m, d,
    diaSemana: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    diasMes: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
}

function sumarDias(iso, n) {
  const { y, m, d } = partes(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ¿Cae un cobro de esta suscripción en la fecha dada?
function tocaCobrarEn(sus, iso) {
  const alta = sus.fecha_alta ? String(sus.fecha_alta).slice(0, 10) : null;
  if (alta) {
    if (alta > iso) return false;   // aún no empezó
    if (alta === iso) return true;  // el día de alta se cobra sí o sí
  }

  const { d: diaActual, m: mes, diaSemana, diasMes } = partes(iso);
  const diaBaseReal = alta ? Number(alta.split('-')[2]) : (sus.dia_cobro || 1);
  const diaBase = Math.min(diaBaseReal, diasMes);

  switch ((sus.frecuencia || 'mensual').toLowerCase()) {
    case 'quincenal': {
      const segunda = diaBase + 15;
      const ajustada = segunda > diasMes ? segunda - diasMes : segunda;
      return diaActual === diaBase || diaActual === ajustada;
    }
    case 'semanal': {
      const objetivo = alta ? partes(alta).diaSemana : (sus.dia_cobro || 0) % 7;
      return diaSemana === objetivo;
    }
    case 'anual': {
      const mesObjetivo = alta ? Number(alta.split('-')[1]) : (sus.mes_cobro || 0) + 1;
      return diaActual === diaBase && mes === mesObjetivo;
    }
    default:
      return diaActual === diaBase;
  }
}

// Último día de cobro (hoy o hasta `diasAtras` atrás) sin ningún envío 'Enviado'
// en esa fecha o después. Devuelve { fechaCobro, diasVencido } o null.
function ultimoCobroSinEnviar(sus, historial, hoy, diasAtras = VENTANA_BUSQUEDA_DIAS) {
  const enviados = historial
    .filter((h) => h.suscripcion_id === sus.id && h.estado === 'Enviado' && h.fecha)
    .map((h) => aISO(new Date(h.fecha)));

  for (let atras = 0; atras <= diasAtras; atras++) {
    const iso = sumarDias(hoy, -atras);
    if (!tocaCobrarEn(sus, iso)) continue;
    const cubierto = enviados.some((f) => f >= iso);
    return cubierto ? null : { fechaCobro: iso, diasVencido: atras };
  }
  return null;
}

// Decide qué enviar hoy.
//  enviar:        cobros de hoy sin enviar + vencidos dentro de la ventana de reintento
//  yaEnviadosHoy: suscripciones que tocan hoy y ya tienen su envío
//  perdidos:      vencidos más allá de la ventana (solo se informan)
// ventana = 0 desactiva el reintento de vencidos.
function planificarCobros(suscripciones, historial, hoy, { ventana = VENTANA_REINTENTO_POR_DEFECTO, confirmarReenvio = false } = {}) {
  const enviar = [];
  const yaEnviadosHoy = [];
  const perdidos = [];

  for (const sus of suscripciones) {
    const pendiente = ultimoCobroSinEnviar(sus, historial, hoy);
    if (pendiente) {
      (pendiente.diasVencido <= ventana ? enviar : perdidos).push({ sus, ...pendiente });
    } else if (tocaCobrarEn(sus, hoy)) {
      if (confirmarReenvio) enviar.push({ sus, fechaCobro: hoy, diasVencido: 0 });
      else yaEnviadosHoy.push(sus);
    }
  }
  return { enviar, yaEnviadosHoy, perdidos };
}

// Días de reintento configurados (COBROS_REINTENTO_DIAS); 0 = solo cobros de hoy
function ventanaReintento() {
  const v = Number.parseInt(process.env.COBROS_REINTENTO_DIAS ?? '', 10);
  return Number.isNaN(v) || v < 0 ? VENTANA_REINTENTO_POR_DEFECTO : v;
}

module.exports = { aISO, hoyISO, sumarDias, tocaCobrarEn, ultimoCobroSinEnviar, planificarCobros, ventanaReintento };
