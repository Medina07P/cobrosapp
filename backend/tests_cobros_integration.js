// Prueba de integración del scheduler: usa la base de desarrollo (backend/data/sgcrc.db)
// con un usuario temporal que se borra al terminar. El correo está simulado.
// NO ejecutar contra la base de producción.
require('dotenv').config();
const assert = require('assert');
const database = require('./database');
const db = require('./db');
const mailer = require('./mailer');
const cobros = require('./cobros');
const { procesarCobrosDelDia, procesarSeleccionados, resumenCobros } = require('./scheduler');

const hoy = cobros.hoyISO();
const hace = (n) => cobros.sumarDias(hoy, -n);
const nombres = (lista) => lista.map((i) => i.cliente).sort();

async function run() {
  const usuarioId = Number(
    database.prepare('INSERT INTO usuarios (email, password, nombre) VALUES (?, ?, ?)')
      .run(`cobros_${Date.now()}@test.local`, 'x', 'Prueba cobros').lastInsertRowid
  );

  let otroUsuarioId = null;
  const enviados = [];
  const enviarOriginal = mailer.enviarCobro;
  mailer.enviarCobro = async ({ cliente }) => { enviados.push(cliente.nombre); };

  try {
    const semanal = db.planes.create({ nombre_plan: 'Semanal prueba', monto: 50000, frecuencia: 'semanal', dia_cobro: 1 }, usuarioId);
    const anual = db.planes.create({ nombre_plan: 'Anual prueba', monto: 90000, frecuencia: 'anual', dia_cobro: 1 }, usuarioId);

    const suscribir = (nombre, plan, fechaAlta) => {
      const cliente = db.clientes.create({ nombre, correo: `${nombre}@test.local` }, usuarioId);
      const s = db.suscripciones.create({ cliente_id: cliente.id, plan_id: plan.id, fecha_alta: fechaAlta }, usuarioId);
      database.prepare('UPDATE suscripciones SET cobro_desde = NULL WHERE id = ?').run(s.id); // simula suscripción antigua
      return s;
    };
    const registrar = (sus, estado, diasAtras) => db.historial.create({
      suscripcion_id: sus.id, estado, detalles: 'prueba', monto: sus.monto,
      fecha: `${hace(diasAtras)}T15:00:00.000Z`,
    }, usuarioId);

    // Día de cobro anual: hace 10 días (se evita el 29 de febrero)
    const fechaPerdido = hace(10).endsWith('-02-29') ? hace(11) : hace(10);
    const [anio, mes, dia] = fechaPerdido.split('-');

    suscribir('vencido', semanal, hace(9));                    // cobro hace 2 días, sin envío
    registrar(suscribir('cubierto', semanal, hace(9)), 'Enviado', 1); // ya enviado después del cobro
    suscribir('perdido', anual, `${Number(anio) - 1}-${mes}-${dia}`);  // cobro hace 10 días
    suscribir('dehoy', semanal, hace(14));                     // cobro hoy
    registrar(suscribir('reintento', semanal, hace(8)), 'Fallido', 1); // cobro ayer, falló

    // 1. Resumen antes de enviar
    const antes = resumenCobros(usuarioId);
    assert.deepStrictEqual(nombres(antes.paraHoy), ['dehoy']);
    assert.deepStrictEqual(nombres(antes.vencidos), ['reintento', 'vencido']);
    assert.deepStrictEqual(nombres(antes.perdidos), ['perdido']);

    // 2. Primera ejecución: hoy + vencidos; el perdido no se envía
    const r1 = await procesarCobrosDelDia(usuarioId, false);
    assert.deepStrictEqual(enviados.slice().sort(), ['dehoy', 'reintento', 'vencido']);
    assert.strictEqual(r1.enviados, 3);
    assert.strictEqual(r1.vencidosEnviados, 2);
    assert.strictEqual(r1.perdidos, 1);
    const detalles = db.historial.all(usuarioId).filter((h) => h.estado === 'Enviado').map((h) => h.detalles);
    assert.ok(detalles.some((d) => d.includes(`vencido desde ${hace(2)}`)), 'el historial debe indicar el vencimiento');

    // 3. Segunda ejecución: no repite nada
    enviados.length = 0;
    const r2 = await procesarCobrosDelDia(usuarioId, false);
    assert.strictEqual(r2.enviados, 0);
    assert.strictEqual(r2.omitidos, 1);
    assert.deepStrictEqual(enviados, []);

    // 4. Con confirmarReenvio solo se reenvía lo que toca hoy
    const r3 = await procesarCobrosDelDia(usuarioId, true);
    assert.deepStrictEqual(enviados, ['dehoy']);
    assert.strictEqual(r3.enviados, 1);

    // 5. Aislamiento entre usuarios: procesarSeleccionados ignora ids ajenos o inexistentes
    otroUsuarioId = Number(
      database.prepare('INSERT INTO usuarios (email, password, nombre) VALUES (?, ?, ?)')
        .run(`cobros2_${Date.now()}@test.local`, 'x', 'Prueba cobros 2').lastInsertRowid
    );
    const planAjeno = db.planes.create({ nombre_plan: 'Ajeno', monto: 1000, frecuencia: 'semanal', dia_cobro: 1 }, otroUsuarioId);
    const clienteAjeno = db.clientes.create({ nombre: 'ajeno', correo: 'ajeno@test.local' }, otroUsuarioId);
    const susAjena = db.suscripciones.create({ cliente_id: clienteAjeno.id, plan_id: planAjeno.id, fecha_alta: hoy }, otroUsuarioId);
    enviados.length = 0;
    const r4 = await procesarSeleccionados(usuarioId, [susAjena.id, 999999999]);
    assert.strictEqual(r4.enviados, 0);
    assert.deepStrictEqual(enviados, []);

    console.log('OK integración de cobros vencidos');
  } finally {
    mailer.enviarCobro = enviarOriginal;
    database.prepare('DELETE FROM usuarios WHERE id = ?').run(usuarioId); // borra todo en cascada
    if (otroUsuarioId) database.prepare('DELETE FROM usuarios WHERE id = ?').run(otroUsuarioId);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
