const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  aISO, hoyISO, sumarDias, tocaCobrarEn, ultimoCobroSinEnviar, planificarCobros, ventanaReintento, mensajeProceso,
} = require('./cobros');

const sus = (extra) => ({ id: 1, frecuencia: 'mensual', dia_cobro: 15, ...extra });
const enviado = (suscripcion_id, fecha) => ({ suscripcion_id, estado: 'Enviado', fecha });
const fallido = (suscripcion_id, fecha) => ({ suscripcion_id, estado: 'Fallido', fecha });

test('aISO usa la zona de Bogotá, no la del servidor ni UTC', () => {
  // 2026-10-20 02:00 UTC es 2026-10-19 21:00 en Bogotá
  assert.equal(aISO(new Date('2026-10-20T02:00:00Z')), '2026-10-19');
  assert.equal(hoyISO(new Date('2026-10-19T13:00:00Z')), '2026-10-19');
});

test('sumarDias cruza meses y años', () => {
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(sumarDias('2026-01-01', -1), '2025-12-31');
  assert.equal(sumarDias('2026-10-19', 7), '2026-10-26');
});

test('mensual: usa el día de fecha_alta y se ajusta a meses cortos', () => {
  const s = sus({ fecha_alta: '2026-01-31' });
  assert.equal(tocaCobrarEn(s, '2026-03-31'), true);
  assert.equal(tocaCobrarEn(s, '2026-02-28'), true);  // febrero no tiene 31
  assert.equal(tocaCobrarEn(s, '2026-02-27'), false);
});

test('fecha_alta futura no cobra; el día de alta cobra siempre', () => {
  const s = sus({ fecha_alta: '2026-11-05', frecuencia: 'semanal' });
  assert.equal(tocaCobrarEn(s, '2026-11-04'), false);
  assert.equal(tocaCobrarEn(s, '2026-11-05'), true);
});

test('sin fecha_alta usa dia_cobro del plan', () => {
  const s = sus({ dia_cobro: 10 });
  assert.equal(tocaCobrarEn(s, '2026-10-10'), true);
  assert.equal(tocaCobrarEn(s, '2026-10-11'), false);
});

test('quincenal: día base y 15 días después, con ajuste de fin de mes', () => {
  const s = sus({ frecuencia: 'quincenal', fecha_alta: '2026-01-10' });
  assert.equal(tocaCobrarEn(s, '2026-04-10'), true);
  assert.equal(tocaCobrarEn(s, '2026-04-25'), true);
  assert.equal(tocaCobrarEn(s, '2026-04-11'), false);
  const feb = sus({ frecuencia: 'quincenal', fecha_alta: '2026-01-20' });
  assert.equal(tocaCobrarEn(feb, '2026-02-07'), true);  // 20+15=35 → 35-28
  assert.equal(tocaCobrarEn(feb, '2026-02-20'), true);
});

test('semanal: mismo día de la semana que fecha_alta', () => {
  const s = sus({ frecuencia: 'semanal', fecha_alta: '2026-10-05' }); // lunes
  assert.equal(tocaCobrarEn(s, '2026-10-12'), true);
  assert.equal(tocaCobrarEn(s, '2026-10-13'), false);
});

test('anual: mismo día y mes que fecha_alta', () => {
  const s = sus({ frecuencia: 'anual', fecha_alta: '2025-03-10' });
  assert.equal(tocaCobrarEn(s, '2026-03-10'), true);
  assert.equal(tocaCobrarEn(s, '2026-04-10'), false);
});

test('un cobro de hace 2 días sin envío está vencido por 2 días', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  assert.deepEqual(ultimoCobroSinEnviar(s, [], '2026-10-19'), { fechaCobro: '2026-10-17', diasVencido: 2 });
});

test('un envío exitoso posterior al día de cobro lo cubre', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  const h = [enviado(1, '2026-10-18T13:00:00Z')];
  assert.equal(ultimoCobroSinEnviar(s, h, '2026-10-19'), null);
});

test('un envío anterior al día de cobro no lo cubre', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  const h = [enviado(1, '2026-09-17T13:00:00Z')];
  assert.equal(ultimoCobroSinEnviar(s, h, '2026-10-19').fechaCobro, '2026-10-17');
});

test('un envío Fallido o de otra suscripción no cubre el cobro', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  const h = [fallido(1, '2026-10-17T13:00:00Z'), enviado(2, '2026-10-17T13:00:00Z')];
  assert.equal(ultimoCobroSinEnviar(s, h, '2026-10-19').diasVencido, 2);
});

test('planificar: hoy sin enviar y vencido reciente se envían; perdido solo se informa', () => {
  const hoy = '2026-10-19';
  const deHoy = sus({ id: 1, fecha_alta: '2026-01-19' });
  const vencido = sus({ id: 2, fecha_alta: '2026-01-15' });   // venció el 15, hace 4 días
  const perdido = sus({ id: 3, fecha_alta: '2026-01-05' });   // venció el 5, hace 14 días
  const plan = planificarCobros([deHoy, vencido, perdido], [], hoy);
  assert.deepEqual(plan.enviar.map((i) => [i.sus.id, i.diasVencido]), [[1, 0], [2, 4]]);
  assert.deepEqual(plan.perdidos.map((i) => [i.sus.id, i.diasVencido]), [[3, 14]]);
  assert.deepEqual(plan.yaEnviadosHoy, []);
});

test('planificar: lo ya enviado hoy se omite salvo confirmarReenvio', () => {
  const hoy = '2026-10-19';
  const s = sus({ id: 1, fecha_alta: '2026-01-19' });
  const h = [enviado(1, '2026-10-19T13:00:00Z')];
  const sin = planificarCobros([s], h, hoy);
  assert.equal(sin.enviar.length, 0);
  assert.equal(sin.yaEnviadosHoy.length, 1);
  const con = planificarCobros([s], h, hoy, { confirmarReenvio: true });
  assert.deepEqual(con.enviar.map((i) => i.sus.id), [1]);
});

test('planificar: tras un Fallido el cobro se reintenta; ventana 0 solo cobra hoy', () => {
  const s = sus({ id: 1, fecha_alta: '2026-01-18' });
  const h = [fallido(1, '2026-10-18T13:00:00Z')];
  assert.equal(planificarCobros([s], h, '2026-10-19').enviar[0].diasVencido, 1);
  assert.equal(planificarCobros([s], h, '2026-10-19', { ventana: 0 }).enviar.length, 0);
  assert.equal(planificarCobros([s], h, '2026-10-19', { ventana: 0 }).perdidos.length, 1);
});

test('ventanaReintento lee COBROS_REINTENTO_DIAS y cae a 7 si es inválida', () => {
  const previo = process.env.COBROS_REINTENTO_DIAS;
  try {
    delete process.env.COBROS_REINTENTO_DIAS;
    assert.equal(ventanaReintento(), 7);
    process.env.COBROS_REINTENTO_DIAS = '0';
    assert.equal(ventanaReintento(), 0);
    process.env.COBROS_REINTENTO_DIAS = '3';
    assert.equal(ventanaReintento(), 3);
    process.env.COBROS_REINTENTO_DIAS = 'abc';
    assert.equal(ventanaReintento(), 7);
    process.env.COBROS_REINTENTO_DIAS = '-2';
    assert.equal(ventanaReintento(), 7);
  } finally {
    if (previo === undefined) delete process.env.COBROS_REINTENTO_DIAS;
    else process.env.COBROS_REINTENTO_DIAS = previo;
  }
});

test('una fila de historial con fecha inválida se ignora y no rompe el cálculo', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  const h = [{ suscripcion_id: 1, estado: 'Enviado', fecha: 'no-es-una-fecha' }];
  assert.deepEqual(ultimoCobroSinEnviar(s, h, '2026-10-19'), { fechaCobro: '2026-10-17', diasVencido: 2 });
});

test('una fecha de historial sin zona (YYYY-MM-DD HH:MM:SS) se interpreta como UTC', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  // 2026-10-17 03:00 UTC = 2026-10-16 22:00 en Bogotá: es anterior al cobro del día 17, no lo cubre.
  // Leído como hora local de Bogotá sería el día 17 y lo cubriría por error.
  const h = [enviado(1, '2026-10-17 03:00:00')];
  assert.equal(ultimoCobroSinEnviar(s, h, '2026-10-19').fechaCobro, '2026-10-17');
});

test('fecha_alta con parte de hora se usa solo por su fecha', () => {
  const s = sus({ fecha_alta: '2026-01-17T05:00:00Z' });
  assert.equal(tocaCobrarEn(s, '2026-10-17'), true);
  assert.equal(tocaCobrarEn(s, '2026-10-18'), false);
});

test('cobro_desde: los cobros anteriores a esa fecha no cuentan como vencidos', () => {
  const posterior = sus({ fecha_alta: '2026-01-17', cobro_desde: '2026-10-18' });
  assert.equal(ultimoCobroSinEnviar(posterior, [], '2026-10-19'), null); // el cobro del 17 es anterior
  const igual = sus({ fecha_alta: '2026-01-17', cobro_desde: '2026-10-17' });
  assert.deepEqual(ultimoCobroSinEnviar(igual, [], '2026-10-19'), { fechaCobro: '2026-10-17', diasVencido: 2 });
});

test('cobro_desde: un cobro anterior ni se envía ni figura como perdido; el de hoy sí se envía', () => {
  const hoy = '2026-10-19';
  const reactivada = sus({ id: 1, fecha_alta: '2026-01-15', cobro_desde: hoy });   // venció el 15
  const deHoy = sus({ id: 2, fecha_alta: '2026-01-19', cobro_desde: hoy });         // toca hoy
  const plan = planificarCobros([reactivada, deHoy], [], hoy);
  assert.deepEqual(plan.enviar.map((i) => i.sus.id), [2]);
  assert.deepEqual(plan.perdidos, []);
});

test('cobro_desde con parte de hora o vacío se trata como fecha o sin restricción', () => {
  const conHora = sus({ fecha_alta: '2026-01-17', cobro_desde: '2026-10-18T05:00:00Z' });
  assert.equal(ultimoCobroSinEnviar(conHora, [], '2026-10-19'), null);
  const vacio = sus({ fecha_alta: '2026-01-17', cobro_desde: null });
  assert.equal(ultimoCobroSinEnviar(vacio, [], '2026-10-19').diasVencido, 2);
});

test('planificar: con cobro_desde posterior a hoy no se envía ni se reporta como ya enviado', () => {
  const s = sus({ id: 1, fecha_alta: '2026-01-19', cobro_desde: '2026-10-20' });
  const plan = planificarCobros([s], [], '2026-10-19', { confirmarReenvio: true });
  assert.deepEqual(plan.enviar, []);
  assert.deepEqual(plan.yaEnviadosHoy, []);
  assert.deepEqual(plan.perdidos, []);
});

test('mensajeProceso: solo enviados', () => {
  assert.equal(mensajeProceso({ enviados: 3 }), 'Proceso completado: 3 enviados');
});

test('mensajeProceso: vencidos y ya enviados', () => {
  assert.equal(
    mensajeProceso({ enviados: 2, vencidosEnviados: 1, omitidos: 4 }),
    'Proceso completado: 2 enviados (1 vencidos). 4 ya enviados hoy se omitieron'
  );
});

test('mensajeProceso: los omitidos por rebote no se presentan como enviados', () => {
  const m = mensajeProceso({ enviados: 0, omitidosRebote: 2 });
  assert.equal(m, 'Proceso completado: 0 enviados. 2 con correo rebotado no se enviaron');
  assert.ok(!m.includes('ya enviados'));
});
