const assert = require('assert');
const http = require('http');

function request({ port, method = 'GET', path = '/', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  process.env.API_KEY = 'test-key';
  delete require.cache[require.resolve('./api')];
  const { iniciarAPI } = require('./api');

  const server = iniciarAPI(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;

  try {
    const root = await request({ port, path: '/' });
    assert.strictEqual(root.status, 200);
    assert.match(root.headers['content-type'] || '', /text\/html/);

    const health = await request({ port, path: '/health' });
    assert.strictEqual(health.status, 200);

    const noKey = await request({ port, path: '/clientes' });
    assert.strictEqual(noKey.status, 401);

    const badEmail = await request({
      port,
      method: 'POST',
      path: '/clientes',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-key' },
      body: JSON.stringify({ nombre: 'Acme', correo: 'correo-invalido' }),
    });
    assert.strictEqual(badEmail.status, 400);

    const okClient = await request({
      port,
      method: 'POST',
      path: '/clientes',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-key' },
      body: JSON.stringify({ nombre: 'Acme', correo: 'admin@acme.co' }),
    });
    assert.strictEqual(okClient.status, 201);

    const badSub = await request({
      port,
      method: 'POST',
      path: '/suscripciones',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-key' },
      body: JSON.stringify({ cliente_id: 1, tipo: 'Plan', monto: -10, dia_cobro: 5 }),
    });
    assert.strictEqual(badSub.status, 400);

    console.log('OK backend smoke test');
  } finally {
    await new Promise((r) => server.close(r));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
