// Pruebas de seguridad de la API: aislamiento entre usuarios, inyección por nombres de columna
// y cobro_desde. Usa la base de desarrollo (backend/data/sgcrc.db) con usuarios temporales
// que se borran al terminar. NO ejecutar contra la base de producción.
require('dotenv').config();
const assert = require('assert');
const http = require('http');
const database = require('./database');
const cobros = require('./cobros');

function request({ port, method = 'GET', path = '/', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function json(port, method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request({ port, method, path, headers, body: body ? JSON.stringify(body) : undefined });
}

// Verifica el estado HTTP y devuelve el cuerpo ya convertido a objeto
function esperar(respuesta, status, mensaje) {
  assert.strictEqual(respuesta.status, status, `${mensaje} (recibido ${respuesta.status}: ${respuesta.body})`);
  return respuesta.body ? JSON.parse(respuesta.body) : null;
}

async function crearUsuario(port, prefijo) {
  const email = `${prefijo}_${Date.now()}@test.local`;
  esperar(await json(port, 'POST', '/auth/register', { email, password: 'test1234', nombre: prefijo }), 201, 'registro');
  const login = esperar(await json(port, 'POST', '/auth/login', { email, password: 'test1234' }), 200, 'login');
  const id = database.prepare('SELECT id FROM usuarios WHERE email = ?').get(email).id;
  return { email, id, token: login.token };
}

async function run() {
  delete require.cache[require.resolve('./api')];
  const { iniciarAPI } = require('./api');
  const server = iniciarAPI(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const hoy = cobros.hoyISO();
  const correos = [];

  const fila = (tabla, id) => database.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(id);

  try {
    const A = await crearUsuario(port, 'seg_a'); correos.push(A.email);
    const B = await crearUsuario(port, 'seg_b'); correos.push(B.email);

    // Datos de cada usuario
    const crear = async (u, etiqueta) => {
      const cliente = esperar(await json(port, 'POST', '/clientes', { nombre: `Cliente ${etiqueta}`, correo: `${etiqueta}@test.local` }, u.token), 201, `cliente ${etiqueta}`);
      const plan = esperar(await json(port, 'POST', '/planes', { nombre_plan: `Plan ${etiqueta}`, monto: 1000, dia_cobro: 5, frecuencia: 'mensual' }, u.token), 201, `plan ${etiqueta}`);
      return { cliente, plan };
    };
    const datosA = await crear(A, 'A');
    const datosB = await crear(B, 'B');
    const subA = esperar(await json(port, 'POST', '/suscripciones', { cliente_id: datosA.cliente.id, plan_id: datosA.plan.id, fecha_alta: '2026-01-05' }, A.token), 201, 'suscripción A');

    // 1. B no puede modificar los recursos de A
    esperar(await json(port, 'PUT', `/clientes/${datosA.cliente.id}`, { nombre: 'hack' }, B.token), 404, 'B edita cliente de A');
    esperar(await json(port, 'PUT', `/planes/${datosA.plan.id}`, { nombre_plan: 'hack' }, B.token), 404, 'B edita plan de A');
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { activa: false }, B.token), 404, 'B edita suscripción de A');
    assert.strictEqual(fila('clientes', datosA.cliente.id).nombre, 'Cliente A');
    assert.strictEqual(fila('planes', datosA.plan.id).nombre_plan, 'Plan A');
    assert.strictEqual(fila('suscripciones', subA.id).activa, 1);

    // 2. Un nombre de columna malicioso se ignora (no hay inyección SQL)
    esperar(await json(port, 'PUT', `/clientes/${datosA.cliente.id}`, { "nombre = 'x', usuario_id": 999 }, A.token), 200, 'PUT con clave maliciosa');
    const clienteTras = fila('clientes', datosA.cliente.id);
    assert.strictEqual(clienteTras.usuario_id, A.id, 'el cliente debe seguir siendo de A');
    assert.strictEqual(clienteTras.nombre, 'Cliente A');
    esperar(await json(port, 'PUT', `/clientes/${datosA.cliente.id}`, { usuario_id: B.id, nombre: 'Cliente A' }, A.token), 200, 'PUT con usuario_id');
    assert.strictEqual(fila('clientes', datosA.cliente.id).usuario_id, A.id, 'usuario_id no se puede reasignar');

    // 3. Referencias a recursos de otro usuario
    esperar(await json(port, 'POST', '/suscripciones', { cliente_id: datosA.cliente.id, plan_id: datosB.plan.id }, B.token), 400, 'B usa cliente de A');
    esperar(await json(port, 'POST', '/suscripciones', { cliente_id: datosB.cliente.id, plan_id: datosA.plan.id }, B.token), 400, 'B usa plan de A');
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { plan_id: datosB.plan.id }, A.token), 400, 'A usa plan de B');
    assert.strictEqual(fila('suscripciones', subA.id).plan_id, datosA.plan.id);

    // 4. El dueño sí puede editar
    const clienteEditado = esperar(await json(port, 'PUT', `/clientes/${datosA.cliente.id}`, { nombre: 'Cliente A2', correo: 'a2@test.local' }, A.token), 200, 'A edita su cliente');
    assert.strictEqual(clienteEditado.nombre, 'Cliente A2');
    const planEditado = esperar(await json(port, 'PUT', `/planes/${datosA.plan.id}`, { nombre_plan: 'Plan A2', monto: 2000 }, A.token), 200, 'A edita su plan');
    assert.strictEqual(planEditado.nombre_plan, 'Plan A2');
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { descripcion: 'nota' }, A.token), 200, 'A edita su suscripción');

    // 5. cobro_desde: se fija al crear, al reactivar y al cambiar fecha_alta; el cliente no puede fijarlo
    assert.strictEqual(fila('suscripciones', subA.id).cobro_desde, hoy, 'al crear, cobro_desde = hoy');
    const fijarAntiguo = () => database.prepare("UPDATE suscripciones SET cobro_desde = '2020-01-01' WHERE id = ?").run(subA.id);
    const cobroDesde = () => fila('suscripciones', subA.id).cobro_desde;

    fijarAntiguo();
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { descripcion: 'otra nota' }, A.token), 200, 'editar descripción');
    assert.strictEqual(cobroDesde(), '2020-01-01', 'editar la descripción no cambia cobro_desde');
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { fecha_alta: '2026-01-05' }, A.token), 200, 'misma fecha_alta');
    assert.strictEqual(cobroDesde(), '2020-01-01', 'la misma fecha_alta no cambia cobro_desde');
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { activa: true }, A.token), 200, 'activa sigue activa');
    assert.strictEqual(cobroDesde(), '2020-01-01', 'activar una suscripción ya activa no cambia cobro_desde');
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { activa: false }, A.token), 200, 'pausar');
    assert.strictEqual(cobroDesde(), '2020-01-01', 'pausar no cambia cobro_desde');
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { activa: true }, A.token), 200, 'reactivar');
    assert.strictEqual(cobroDesde(), hoy, 'reactivar fija cobro_desde = hoy');

    fijarAntiguo();
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { fecha_alta: '2026-01-06' }, A.token), 200, 'cambiar fecha_alta');
    assert.strictEqual(cobroDesde(), hoy, 'cambiar fecha_alta fija cobro_desde = hoy');

    fijarAntiguo();
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { cobro_desde: '1999-01-01' }, A.token), 200, 'intento de fijar cobro_desde');
    assert.strictEqual(cobroDesde(), '2020-01-01', 'el cliente no puede fijar cobro_desde');

    // 6. Una suscripción nueva con fecha_alta pasada también arranca desde hoy
    const subPasada = esperar(await json(port, 'POST', '/suscripciones', { cliente_id: datosA.cliente.id, plan_id: datosA.plan.id, fecha_alta: '2025-01-01' }, A.token), 201, 'suscripción con fecha pasada');
    assert.strictEqual(fila('suscripciones', subPasada.id).cobro_desde, hoy);

    console.log('OK pruebas de seguridad');
  } finally {
    for (const correo of correos) database.prepare('DELETE FROM usuarios WHERE email = ?').run(correo); // borra todo en cascada
    await new Promise((r) => server.close(r));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
