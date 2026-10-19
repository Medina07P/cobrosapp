const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  aISO, hoyISO, sumarDias, tocaCobrarEn, ultimoCobroSinEnviar, planificarCobros, ventanaReintento,
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
