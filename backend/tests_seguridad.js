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

async function crearUsuario(port, prefijo, correos) {
  const email = `${prefijo}_${Date.now()}@test.local`;
  correos.push(email); // antes de registrar: si algo falla, el finally lo borra
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
    const A = await crearUsuario(port, 'seg_a', correos);
    const B = await crearUsuario(port, 'seg_b', correos);

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

    // 7. Claves maliciosas y reasignación de usuario también en planes y suscripciones
    esperar(await json(port, 'PUT', `/planes/${datosA.plan.id}`, { "nombre_plan = 'x', usuario_id": 999 }, A.token), 200, 'PUT plan con clave maliciosa');
    esperar(await json(port, 'PUT', `/planes/${datosA.plan.id}`, { usuario_id: B.id }, A.token), 200, 'PUT plan con usuario_id');
    assert.strictEqual(fila('planes', datosA.plan.id).usuario_id, A.id, 'usuario_id del plan no se reasigna');
    assert.strictEqual(fila('planes', datosA.plan.id).nombre_plan, 'Plan A2');
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { "descripcion = 'x', usuario_id": 999 }, A.token), 200, 'PUT sub con clave maliciosa');
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { usuario_id: B.id }, A.token), 200, 'PUT sub con usuario_id');
    assert.strictEqual(fila('suscripciones', subA.id).usuario_id, A.id, 'usuario_id de la suscripción no se reasigna');

    // 8. Cliente ajeno en PUT de suscripción, ids inexistentes y no numéricos
    esperar(await json(port, 'PUT', `/suscripciones/${subA.id}`, { cliente_id: datosB.cliente.id }, A.token), 400, 'A usa cliente de B');
    for (const ruta of ['clientes', 'planes', 'suscripciones']) {
      esperar(await json(port, 'PUT', `/${ruta}/99999999`, { descripcion: 'x' }, A.token), 404, `PUT ${ruta} inexistente`);
      esperar(await json(port, 'PUT', `/${ruta}/abc`, { descripcion: 'x' }, A.token), 404, `PUT ${ruta} id no numérico`);
    }

    // 9. Valores inválidos -> 400 (nunca 500)
    const c = `/clientes/${datosA.cliente.id}`, p = `/planes/${datosA.plan.id}`, s = `/suscripciones/${subA.id}`;
    const malo = async (metodo, ruta, cuerpo, etiqueta) => {
      const r = esperar(await json(port, metodo, ruta, cuerpo, A.token), 400, etiqueta);
      assert.ok(r && typeof r.error === 'string' && !r.error.includes('VALIDATION_ERROR'), `${etiqueta}: mensaje limpio`);
    };
    await malo('PUT', c, { nombre: { a: 1 } }, 'cliente nombre objeto');
    await malo('PUT', c, { nombre: null }, 'cliente nombre null');
    await malo('PUT', c, { correo: 'sin-arroba' }, 'cliente correo sin arroba');
    await malo('POST', '/clientes', { nombre: [], correo: 'x@y.z' }, 'POST cliente nombre arreglo');
    await malo('POST', '/clientes', { nombre: 'X' }, 'POST cliente sin correo');
    await malo('PUT', p, { monto: 'abc' }, 'plan monto abc');
    await malo('PUT', p, { monto: true }, 'plan monto booleano');
    await malo('PUT', p, { frecuencia: 'diaria' }, 'plan frecuencia inválida');
    await malo('PUT', p, { dia_cobro: 40 }, 'plan dia_cobro 40');
    await malo('POST', '/planes', { nombre_plan: 'X', monto: -1, frecuencia: 'mensual', dia_cobro: 5 }, 'POST plan monto negativo');
    await malo('PUT', s, { activa: 'false' }, 'sub activa string false');
    await malo('PUT', s, { activa: 'x' }, 'sub activa basura');
    await malo('PUT', s, { fecha_alta: 'ayer' }, 'sub fecha_alta ayer');
    await malo('PUT', s, { fecha_alta: '' }, 'sub fecha_alta vacía');
    await malo('PUT', s, { fecha_alta: null }, 'sub fecha_alta null');
    await malo('PUT', s, { fecha_alta: '2026-02-31' }, 'sub fecha_alta inexistente');
    await malo('PUT', s, { cliente_id: true }, 'sub cliente_id booleano');
    await malo('POST', '/suscripciones', { cliente_id: true, plan_id: datosA.plan.id }, 'POST sub cliente_id true');
    await malo('POST', '/suscripciones', { cliente_id: datosA.cliente.id, plan_id: [1] }, 'POST sub plan_id arreglo');
    await malo('POST', '/suscripciones', { cliente_id: datosA.cliente.id, plan_id: datosA.plan.id, fecha_alta: '2026-13-01' }, 'POST sub fecha inválida');
    assert.strictEqual(fila('clientes', datosA.cliente.id).nombre, 'Cliente A2', 'los rechazos no modifican datos');

    // 10. Cadenas numéricas aceptadas y guardadas como números; extras del frontend ignorados
    esperar(await json(port, 'PUT', p, { monto: '2500', dia_cobro: '10', frecuencia: 'MENSUAL', id: 5, tipo: 'x' }, A.token), 200, 'plan con números en cadena');
    const planNum = fila('planes', datosA.plan.id);
    assert.strictEqual(planNum.monto, 2500); assert.strictEqual(planNum.dia_cobro, 10); assert.strictEqual(planNum.frecuencia, 'mensual');
    esperar(await json(port, 'PUT', p, { monto: 0 }, A.token), 200, 'monto 0 permitido');
    const subCreada = esperar(await json(port, 'POST', '/suscripciones', { cliente_id: String(datosA.cliente.id), plan_id: String(datosA.plan.id), fecha_alta: '', descripcion: null, activa: true }, A.token), 201, 'POST sub con cadenas y fecha vacía');
    assert.strictEqual(fila('suscripciones', subCreada.id).fecha_alta, hoy, 'fecha vacía al crear = hoy');
    assert.strictEqual(fila('suscripciones', subCreada.id).descripcion, '');

    // 11. planes.update ajusta cobro_desde solo si cambia frecuencia o dia_cobro
    fijarAntiguo();
    esperar(await json(port, 'PUT', p, { monto: 3000, nombre_plan: 'Plan A3', descripcion: 'd' }, A.token), 200, 'plan: solo monto');
    assert.strictEqual(cobroDesde(), '2020-01-01', 'cambiar monto no toca cobro_desde');
    esperar(await json(port, 'PUT', p, { frecuencia: 'mensual', dia_cobro: 10 }, A.token), 200, 'plan: mismos valores');
    assert.strictEqual(cobroDesde(), '2020-01-01', 'mismos valores no tocan cobro_desde');
    esperar(await json(port, 'PUT', p, { frecuencia: 'quincenal' }, A.token), 200, 'plan: frecuencia');
    assert.strictEqual(cobroDesde(), hoy, 'cambiar frecuencia fija cobro_desde = hoy');
    fijarAntiguo();
    esperar(await json(port, 'PUT', p, { dia_cobro: 12 }, A.token), 200, 'plan: dia_cobro');
    assert.strictEqual(cobroDesde(), hoy, 'cambiar dia_cobro fija cobro_desde = hoy');

    // 12. Perfil: color y WhatsApp se validan; el WhatsApp se normaliza y se puede borrar
    esperar(await json(port, 'PATCH', '/usuario/config-tema', { color_tema: 'rojo' }, A.token), 400, 'color inválido');
    esperar(await json(port, 'PATCH', '/usuario/config-tema', { color_tema: '#1F6B4F', whatsapp: 'abc' }, A.token), 400, 'whatsapp inválido');
    assert.notStrictEqual(database.prepare('SELECT color_tema FROM usuarios WHERE id = ?').get(A.id).color_tema, 'rojo');
    esperar(await json(port, 'PATCH', '/usuario/config-tema', { color_tema: '#1F6B4F', whatsapp: '+57 300 123 4567' }, A.token), 200, 'perfil válido');
    assert.strictEqual(esperar(await json(port, 'GET', '/usuario/perfil', undefined, A.token), 200, 'perfil').whatsapp, '573001234567');
    esperar(await json(port, 'PATCH', '/usuario/config-tema', { whatsapp: '' }, A.token), 200, 'borrar whatsapp');
    assert.strictEqual(esperar(await json(port, 'GET', '/usuario/perfil', undefined, A.token), 200, 'perfil').whatsapp, null);
    // Guardar sin tocar el WhatsApp (el frontend reenvía todo el perfil) no lo borra
    esperar(await json(port, 'PATCH', '/usuario/config-tema', { whatsapp: '573001234567' }, B.token), 200, 'B guarda whatsapp');
    esperar(await json(port, 'PATCH', '/usuario/config-tema', { nombre: 'B renombrado' }, B.token), 200, 'B cambia nombre');
    assert.strictEqual(esperar(await json(port, 'GET', '/usuario/perfil', undefined, B.token), 200, 'perfil B').whatsapp, '573001234567');

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
