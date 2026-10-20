require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-pruebas';
const assert = require('assert');
const http = require('http');

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

async function run() {
  delete require.cache[require.resolve('./api')];
  const { iniciarAPI } = require('./api');

  const server = iniciarAPI(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;

  // Email único por ejecución para no colisionar con datos previos
  const testEmail = `smoke_${Date.now()}@test.local`;

  try {
    // 1. /health es público
    const health = await request({ port, path: '/health' });
    assert.strictEqual(health.status, 200, '/health debe devolver 200');

    // 2. Rutas protegidas sin token devuelven 401
    const sinToken = await request({ port, path: '/clientes' });
    assert.strictEqual(sinToken.status, 401, '/clientes sin JWT debe devolver 401');

    // 3. Registro de usuario de prueba
    const registro = await json(port, 'POST', '/auth/register', {
      email: testEmail,
      password: 'test1234',
      nombre: 'Smoke Test',
    });
    assert.strictEqual(registro.status, 201, 'Registro debe devolver 201');

    // 4. Login y obtención del token JWT
    const loginRes = await json(port, 'POST', '/auth/login', {
      email: testEmail,
      password: 'test1234',
    });
    assert.strictEqual(loginRes.status, 200, 'Login debe devolver 200');
    const { token } = JSON.parse(loginRes.body);
    assert.ok(token, 'Login debe devolver un token JWT');

    // 5. Listar clientes con token válido
    const clientes = await json(port, 'GET', '/clientes', undefined, token);
    assert.strictEqual(clientes.status, 200, 'GET /clientes con JWT debe devolver 200');

    // 6. Crear un cliente
    const nuevoCliente = await json(port, 'POST', '/clientes', {
      nombre: 'Cliente Smoke',
      correo: 'smoke@cliente.co',
    }, token);
    assert.strictEqual(nuevoCliente.status, 201, 'POST /clientes debe devolver 201');

    // 7. POST /suscripciones sin cliente_id ni plan_id debe devolver 400
    const subInvalida = await json(port, 'POST', '/suscripciones', {
      descripcion: 'Sin cliente ni plan',
    }, token);
    assert.strictEqual(subInvalida.status, 400, 'Suscripción sin campos obligatorios debe devolver 400');

    // 8. /cobros/resumen exige JWT y devuelve las tres listas
    const resumenSinToken = await json(port, 'GET', '/cobros/resumen');
    assert.strictEqual(resumenSinToken.status, 401, '/cobros/resumen sin JWT debe devolver 401');
    const resumen = await json(port, 'GET', '/cobros/resumen', undefined, token);
    assert.strictEqual(resumen.status, 200, 'GET /cobros/resumen con JWT debe devolver 200');
    const datosResumen = JSON.parse(resumen.body);
    assert.ok(Array.isArray(datosResumen.paraHoy), 'resumen.paraHoy debe ser un arreglo');
    assert.ok(Array.isArray(datosResumen.vencidos), 'resumen.vencidos debe ser un arreglo');
    assert.ok(Array.isArray(datosResumen.perdidos), 'resumen.perdidos debe ser un arreglo');
    assert.strictEqual(datosResumen.vencidos.length, 0, 'un usuario nuevo no tiene vencidos');

    console.log('OK backend smoke test');
  } finally {
    await new Promise((r) => server.close(r));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
