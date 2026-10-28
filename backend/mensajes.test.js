const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mensajeProceso } = require('./mensajes');

test('mensajeProceso: solo enviados', () => {
  assert.equal(mensajeProceso({ enviados: 3 }), 'Proceso completado: 3 enviados');
});

test('mensajeProceso: vencidos y ya enviados', () => {
  assert.equal(
    mensajeProceso({ enviados: 2, vencidosEnviados: 1, omitidos: 4 }),
    'Proceso completado: 2 enviados (1 vencido). 4 ya enviados hoy se omitieron'
  );
});

test('mensajeProceso: singular cuando hay un solo cobro de cada tipo', () => {
  assert.equal(
    mensajeProceso({ enviados: 1, vencidosEnviados: 1, omitidos: 1, omitidosRebote: 1 }),
    'Proceso completado: 1 enviado (1 vencido). 1 ya enviado hoy se omitió. 1 con correo rebotado no se envió'
  );
});

test('mensajeProceso: los omitidos por rebote no se presentan como enviados', () => {
  const m = mensajeProceso({ enviados: 0, omitidosRebote: 2 });
  assert.equal(m, 'Proceso completado: 0 enviados. 2 con correo rebotado no se enviaron');
  assert.ok(!m.includes('ya enviados'));
});
