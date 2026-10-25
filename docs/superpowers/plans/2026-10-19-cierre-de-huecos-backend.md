# Cierre de huecos del backend. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los huecos detectados en la revisión de "cobros vencidos": (1) aislamiento entre usuarios e inyección SQL por nombres de columna en las actualizaciones; (2) cobros "vencidos" falsos al reactivar una suscripción o editar/registrar `fecha_alta` pasada; (3) WhatsApp de otra empresa fijo en los correos, color y frecuencia sin validar en el HTML del correo.

**Architecture:** Las actualizaciones pasan a una lista blanca de columnas y a `WHERE id = ? AND usuario_id = ?`; la creación/edición de suscripciones valida que cliente y plan sean del usuario. Una columna nueva `suscripciones.cobro_desde` (se fija a "hoy" al crear, reactivar o cambiar `fecha_alta`) hace que el planificador ignore los cobros anteriores. El WhatsApp pasa a ser un dato del usuario (`usuarios.whatsapp`, editable en Configuración); sin número, el correo no lleva el botón.

**Tech Stack:** Node.js (CommonJS), `better-sqlite3`, `node:test`, React 18 (solo la pantalla de Configuración).

## Decisiones (aprobadas por el usuario: "haz las correcciones, que no queden huecos")

- `cobro_desde` se añade con el patrón de migración del proyecto (`ALTER TABLE ... try/catch`). Las filas existentes quedan en `NULL` (sin restricción).
- El cliente de la API **nunca** puede fijar `cobro_desde`; solo el servidor.
- `PUT` de un recurso ajeno devuelve **404** (no 403) para no revelar su existencia.
- El número de WhatsApp se guarda solo con dígitos (8 a 15, con código de país). Vacío = sin botón en el correo.
- Fuera de este plan (se informan): contraseña mínima en el registro, `JWT_SECRET` con valor por defecto en el código (solo se agrega una advertencia al arrancar), CORS abierto (`*`), `config_smtp` expuesto en `/usuario/perfil`.

## Global Constraints

- Rama `develop`. Un commit por tarea. Trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Multi-tenant: toda consulta o escritura sobre clientes, planes y suscripciones filtra por `usuario_id` del JWT. Los nombres de columna de un `UPDATE` nunca provienen del cliente.
- Sin Express. Router imperativo de `api.js`. Sin cambiar dependencias; no ejecutar `npm audit fix`.
- Las pruebas que escriben en la base usan usuarios temporales con email con timestamp y los borran al terminar (también si fallan). Los correos se simulan; nunca se envía uno real. Las pruebas no se ejecutan contra producción (`database.js` usa siempre `data/sgcrc.db`).
- No tocar archivos `.env`.
- Fechas de cobro: `cobros.hoyISO()` (America/Bogota), nunca `toISOString()` de la fecha actual.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/database.js` | Modificar | Columnas `suscripciones.cobro_desde` y `usuarios.whatsapp` |
| `backend/cobros.js`, `backend/cobros.test.js` | Modificar | El planificador respeta `cobro_desde` |
| `backend/db.js` | Modificar | Lista blanca + propiedad en `update`; validación de propiedad en `create`; mantenimiento de `cobro_desde`; `usuarios.updateWhatsapp` |
| `backend/api.js` | Modificar | `PUT` con 404/400; validación de `/usuario/config-tema`; mensajes sin Café Valdore |
| `backend/tests_seguridad.js` | Crear | Pruebas HTTP de aislamiento, inyección, `cobro_desde` y perfil |
| `backend/perfil.js`, `backend/perfil.test.js` | Crear | Validación pura de color y WhatsApp |
| `backend/mailer.js`, `backend/mailer.test.js` | Modificar / Crear | `buildHtml` único, con WhatsApp del usuario, color y frecuencia validados |
| `backend/auth.js`, `backend/index.js` | Modificar | Nombre por defecto neutro; advertencia si falta `JWT_SECRET` |
| `backend/package.json` | Modificar | Scripts `test:unit` (amplía) y `test:security` |
| `sgcrc-frontend-export/src/views/Configuracion.jsx` | Modificar | Campo de WhatsApp y mensajes de error del servidor |
| `backend/CLAUDE.md`, `backend/README.md` | Modificar | Documentar los cambios |

---

### Task 1: `cobro_desde` en el planificador y en el esquema

**Files:**
- Modify: `backend/database.js` (migración), `backend/cobros.js`, `backend/cobros.test.js`

**Interfaces:**
- Produces: columna `suscripciones.cobro_desde TEXT` (`YYYY-MM-DD` o `NULL`); `ultimoCobroSinEnviar(sus, ...)` y `planificarCobros` ignoran los días de cobro anteriores a `sus.cobro_desde`.

- [ ] **Step 1: Pruebas que fallan, al final de `backend/cobros.test.js`**

```js
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
```

- [ ] **Step 2: Ejecutar y ver que fallan**

Run (desde `backend/`): `node --test cobros.test.js`
Expected: FAIL en los dos primeros tests nuevos (el cobro anterior sigue apareciendo).

- [ ] **Step 3: Implementar en `backend/cobros.js`**

En `ultimoCobroSinEnviar`, reemplazar
```js
  for (let atras = 0; atras <= diasAtras; atras++) {
    const iso = sumarDias(hoy, -atras);
    if (!tocaCobrarEn(sus, iso)) continue;
```
por
```js
  // Los cobros anteriores a cobro_desde no cuentan (suscripción creada, reactivada o con fecha_alta editada después)
  const desde = sus.cobro_desde ? String(sus.cobro_desde).slice(0, 10) : null;

  for (let atras = 0; atras <= diasAtras; atras++) {
    const iso = sumarDias(hoy, -atras);
    if (desde && iso < desde) return null;
    if (!tocaCobrarEn(sus, iso)) continue;
```

- [ ] **Step 4: Ejecutar y ver que pasan**

Run: `node --test cobros.test.js`
Expected: todas pasan (22).

- [ ] **Step 5: Migración de la columna en `backend/database.js`**

Justo después de la línea `try { db.prepare("ALTER TABLE suscripciones ADD COLUMN fecha_alta TEXT").run(); } catch(e) {}`, agregar:
```js
// Cobros anteriores a esta fecha no se consideran vencidos (se fija al crear, reactivar o cambiar fecha_alta)
try { db.prepare("ALTER TABLE suscripciones ADD COLUMN cobro_desde TEXT").run(); } catch(e) {}
```
Verificar: `node -e "const d=require('./database');console.log(d.prepare('PRAGMA table_info(suscripciones)').all().some(c=>c.name==='cobro_desde'))"` → `true`.

- [ ] **Step 6: Commit**

```bash
git add backend/cobros.js backend/cobros.test.js backend/database.js
git commit -m "feat(cobros): cobro_desde evita vencidos falsos tras reactivar o editar la fecha de alta

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Aislamiento entre usuarios, lista blanca de columnas y mantenimiento de `cobro_desde`

**Files:**
- Modify: `backend/db.js`, `backend/api.js`, `backend/package.json`
- Create: `backend/tests_seguridad.js`

**Interfaces:**
- Consumes: `cobros.hoyISO()`; columna `suscripciones.cobro_desde`.
- Produces:
  - `db.clientes.update(id, campos, usuarioId)`, `db.planes.update(id, campos, usuarioId)`, `db.suscripciones.update(id, campos, usuarioId)` devuelven el registro actualizado, o `null` si el id no existe o no es del usuario. `suscripciones.update` lanza `Error("VALIDATION_ERROR: ...")` si `cliente_id`/`plan_id` no son del usuario.
  - `db.suscripciones.create` lanza `VALIDATION_ERROR` si cliente o plan no son del usuario, y fija `cobro_desde` a hoy.
  - `PUT /clientes/:id`, `/planes/:id`, `/suscripciones/:id` responden 404 si el recurso no es del usuario; `PUT /suscripciones/:id` responde 400 ante `VALIDATION_ERROR`.
  - Script `npm run test:security`.

- [ ] **Step 1: Escribir la prueba que falla, `backend/tests_seguridad.js`**

```js
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
```

- [ ] **Step 2: Agregar el script y ejecutar para ver que falla**

En `backend/package.json`, dentro de `"scripts"`, agregar `"test:security": "node tests_seguridad.js"`.
Run: `npm run test:security`
Expected: FAIL en `B edita cliente de A (recibido 200 ...)`.

- [ ] **Step 3: `backend/db.js`: helpers de propiedad y lista blanca**

Después de `const db = require('./database');` agregar:
```js
const cobros = require('./cobros');
```
Después de la función `fixBool`, agregar:
```js
// Columnas que la API puede actualizar. Los nombres de columna nunca vienen del cliente.
const COLUMNAS = {
    clientes: ['nombre', 'correo'],
    planes: ['nombre_plan', 'monto', 'frecuencia', 'dia_cobro', 'descripcion'],
    suscripciones: ['cliente_id', 'plan_id', 'activa', 'descripcion', 'fecha_alta'],
};

// Se queda solo con las columnas permitidas de la tabla
function filtrar(tabla, campos) {
    return Object.fromEntries(
        Object.entries(campos || {}).filter(([k, v]) => COLUMNAS[tabla].includes(k) && v !== undefined)
    );
}

function existePropia(tabla, id, usuarioId) {
    return !!db.prepare(`SELECT 1 FROM ${tabla} WHERE id = ? AND usuario_id = ?`).get(id, usuarioId);
}

// UPDATE de una fila del usuario. Las claves ya fueron filtradas por filtrar() o son internas.
function ejecutarUpdate(tabla, id, campos, usuarioId) {
    const claves = Object.keys(campos);
    if (claves.length === 0) return;
    const setClause = claves.map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE ${tabla} SET ${setClause} WHERE id = ? AND usuario_id = ?`)
        .run(...Object.values(campos), id, usuarioId);
}

// El cliente y el plan de una suscripción deben ser del usuario
function validarPropiedad({ cliente_id, plan_id }, usuarioId) {
    if (cliente_id !== undefined && !existePropia('clientes', cliente_id, usuarioId)) {
        throw new Error("VALIDATION_ERROR: El cliente seleccionado no existe.");
    }
    if (plan_id !== undefined && !existePropia('planes', plan_id, usuarioId)) {
        throw new Error("VALIDATION_ERROR: El plan seleccionado no existe.");
    }
}
```

- [ ] **Step 4: `backend/db.js`: reemplazar los `update`**

`planes.update` (reemplazar la función completa, incluida la línea de comentario `// ... (resto de funciones de planes igual)`):
```js
    update(id, campos, usuarioId) {
        if (!existePropia('planes', id, usuarioId)) return null;
        ejecutarUpdate('planes', id, filtrar('planes', campos), usuarioId);
        return this.find(id);
    },
```
`clientes.update`:
```js
    update(id, campos, usuarioId) {
        if (!existePropia('clientes', id, usuarioId)) return null;
        ejecutarUpdate('clientes', id, filtrar('clientes', campos), usuarioId);
        return this.find(id);
    },
```
`suscripciones.update` (reemplazar por completo; el bloque que extraía campos calculados desaparece):
```js
    // Solo actualiza suscripciones del usuario. Reactivar o cambiar fecha_alta fija cobro_desde = hoy.
    update(id, campos, usuarioId) {
        const actual = db.prepare('SELECT * FROM suscripciones WHERE id = ? AND usuario_id = ?').get(id, usuarioId);
        if (!actual) return null;

        const nuevos = filtrar('suscripciones', campos);
        if (nuevos.activa !== undefined) nuevos.activa = nuevos.activa ? 1 : 0;
        if (nuevos.plan_id !== undefined) nuevos.plan_id = Number(nuevos.plan_id);
        if (nuevos.cliente_id !== undefined) nuevos.cliente_id = Number(nuevos.cliente_id);

        validarPropiedad(nuevos, usuarioId);

        const reactiva = nuevos.activa === 1 && actual.activa !== 1;
        const cambiaAlta = nuevos.fecha_alta !== undefined &&
            String(nuevos.fecha_alta).slice(0, 10) !== String(actual.fecha_alta || '').slice(0, 10);
        if (reactiva || cambiaAlta) nuevos.cobro_desde = cobros.hoyISO();

        ejecutarUpdate('suscripciones', id, nuevos, usuarioId);
        return this.find(id);
    },
```

- [ ] **Step 5: `backend/db.js`: `suscripciones.create`**

Reemplazar el cuerpo del `create` de suscripciones por:
```js
    create({ cliente_id, plan_id, descripcion, fecha_alta }, usuarioId = 1) {
        if (!cliente_id || !plan_id) throw new Error("VALIDATION_ERROR: Cliente y Plan son obligatorios.");
        validarPropiedad({ cliente_id: Number(cliente_id), plan_id: Number(plan_id) }, usuarioId);

        try {
            // Si no envías fecha, usa la fecha de hoy (YYYY-MM-DD, zona de la aplicación)
            const hoy = cobros.hoyISO();
            const fechaFinal = fecha_alta || hoy;

            // cobro_desde = hoy: una fecha_alta pasada no genera cobros "vencidos" anteriores al registro
            const stmt = db.prepare(`
                INSERT INTO suscripciones (cliente_id, plan_id, usuario_id, activa, descripcion, fecha_alta, cobro_desde) 
                VALUES (?, ?, ?, 1, ?, ?, ?)
            `);
            const info = stmt.run(cliente_id, plan_id, usuarioId, descripcion || '', fechaFinal, hoy);
            return this.find(info.lastInsertRowid);
        } catch (err) {
            if (err.message.includes("FOREIGN KEY")) {
                throw new Error("VALIDATION_ERROR: El cliente o el plan seleccionado no existen.");
            }
            throw err;
        }
    },
```
(Conservar el comentario `// 2. CREATE actualizado...` que lo precede, si existe.)

- [ ] **Step 6: `backend/api.js`: los tres `PUT`**

Clientes: reemplazar el bloque `if (method === "PUT" && id) { ... }` de `/clientes` por
```js
      if (method === "PUT" && id) {
        const body = await parseBody(req);
        const actualizado = db.clientes.update(Number(id), body, usuario.id);
        if (!actualizado) return json(res, 404, { error: "Cliente no encontrado" });
        return json(res, 200, actualizado);
      }
```
Planes: igual, con `db.planes.update(Number(id), body, usuario.id)` y mensaje `"Plan no encontrado"`.
Suscripciones:
```js
      if (method === "PUT" && id) {
        const body = await parseBody(req);
        try {
          const actualizada = db.suscripciones.update(Number(id), body, usuario.id);
          if (!actualizada) return json(res, 404, { error: "Suscripción no encontrada" });
          return json(res, 200, actualizada);
        } catch (dbErr) {
          const status = dbErr.message.includes("VALIDATION_ERROR") ? 400 : 500;
          return json(res, status, { error: dbErr.message.replace("VALIDATION_ERROR: ", "") });
        }
      }
```

- [ ] **Step 7: Ejecutar todas las pruebas**

Run (desde `backend/`): `npm run test:security` → imprime `OK pruebas de seguridad`. Luego `npm run test:unit` (todas pasan), `npm run test:integration` (`OK integración de cobros vencidos`), `npm test` (`OK backend smoke test`).
Verificar que no quedan usuarios temporales: `node -e "const d=require('./database');console.log(d.prepare(\"SELECT COUNT(*) n FROM usuarios WHERE email LIKE 'seg_%@test.local' OR email LIKE 'cobros%@test.local'\").get())"` → `{ n: 0 }`.
Verificar el frontend: desde `sgcrc-frontend-export/`, `npm run build` sin errores (las vistas siguen enviando el mismo cuerpo en los `PUT`; los campos extra se ignoran).

- [ ] **Step 8: Commit**

```bash
git add backend/db.js backend/api.js backend/package.json backend/tests_seguridad.js
git commit -m "fix(seguridad): PUT con dueño y lista blanca de columnas; cobro_desde al crear/reactivar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: WhatsApp por usuario, validación de perfil y correo seguro

**Files:**
- Create: `backend/perfil.js`, `backend/perfil.test.js`, `backend/mailer.test.js`
- Modify: `backend/database.js`, `backend/db.js` (`usuarios`), `backend/api.js`, `backend/mailer.js`, `backend/auth.js`, `backend/index.js`, `backend/package.json`, `backend/tests_seguridad.js`, `sgcrc-frontend-export/src/views/Configuracion.jsx`

**Interfaces:**
- Produces:
  - `perfil.normalizarWhatsapp(valor): string | null | undefined` (`null` si es vacío; `undefined` si es inválido; si no, solo dígitos 8 a 15) y `perfil.colorValido(valor): boolean` (`#RRGGBB`).
  - Columna `usuarios.whatsapp TEXT`; `db.usuarios.findById` la incluye; `db.usuarios.updateWhatsapp(id, numero)`.
  - `PATCH|POST /usuario/config-tema` acepta `whatsapp`; responde 400 con `{ error }` si el color o el WhatsApp son inválidos.
  - `mailer.buildHtml({ cliente, suscripcion, nombreVendedor, color, whatsapp })`: sin WhatsApp válido no incluye el botón.

- [ ] **Step 1: Pruebas que fallan, `backend/perfil.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarWhatsapp, colorValido } = require('./perfil');

test('normalizarWhatsapp deja solo dígitos y acepta 8 a 15', () => {
  assert.equal(normalizarWhatsapp('+57 300 123-4567'), '573001234567');
  assert.equal(normalizarWhatsapp('(57) 300.123.4567'), '573001234567');
  assert.equal(normalizarWhatsapp('12345678'), '12345678');
});

test('normalizarWhatsapp: vacío o null borra el número; inválido devuelve undefined', () => {
  assert.equal(normalizarWhatsapp(''), null);
  assert.equal(normalizarWhatsapp(null), null);
  assert.equal(normalizarWhatsapp('1234567'), undefined);        // muy corto
  assert.equal(normalizarWhatsapp('1234567890123456'), undefined); // muy largo
  assert.equal(normalizarWhatsapp('abc'), undefined);
  assert.equal(normalizarWhatsapp('57300<script>'), undefined);
});

test('colorValido solo acepta #RRGGBB', () => {
  assert.equal(colorValido('#1F6B4F'), true);
  assert.equal(colorValido('#abcdef'), true);
  assert.equal(colorValido('#fff'), false);
  assert.equal(colorValido('red'), false);
  assert.equal(colorValido('#fff;}</style><script>x</script>'), false);
  assert.equal(colorValido(null), false);
});
```

- [ ] **Step 2: Pruebas que fallan, `backend/mailer.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildHtml } = require('./mailer');

const base = {
  cliente: { nombre: 'Ana' },
  suscripcion: { monto: 50000, tipo: 'Plan Oro', frecuencia: 'mensual' },
  nombreVendedor: 'Mi Negocio',
};

test('sin WhatsApp el correo no incluye botón ni números ajenos', () => {
  const html = buildHtml({ ...base });
  assert.ok(!html.includes('wa.me'));
  assert.ok(!html.includes('573014518350'));
  assert.ok(!html.includes('Reportar Pago por WhatsApp'));
});

test('con WhatsApp el enlace usa el número normalizado del usuario', () => {
  const html = buildHtml({ ...base, whatsapp: '+57 300 123 4567' });
  assert.ok(html.includes('https://wa.me/573001234567?text='));
  assert.ok(html.includes('Reportar Pago por WhatsApp'));
});

test('un WhatsApp inválido no genera enlace', () => {
  const html = buildHtml({ ...base, whatsapp: '"><script>x</script>' });
  assert.ok(!html.includes('wa.me'));
  assert.ok(!html.includes('<script>'));
});

test('un color inválido cae al color por defecto y no se inyecta en el HTML', () => {
  const html = buildHtml({ ...base, color: '#fff;}</style><script>x</script>' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('#4f46e5'));
});

test('la frecuencia y el nombre del cliente se escapan', () => {
  const html = buildHtml({
    cliente: { nombre: '<b>Ana</b>' },
    suscripcion: { monto: 1000, tipo: 'X', frecuencia: '<i>mensual</i>' },
  });
  assert.ok(!html.includes('<i>mensual</i>'));
  assert.ok(html.includes('&lt;i&gt;mensual&lt;/i&gt;'));
  assert.ok(!html.includes('<b>Ana</b>'));
});
```

- [ ] **Step 3: Ejecutar y ver que fallan**

Run (desde `backend/`): `node --test perfil.test.js mailer.test.js`
Expected: FAIL (`Cannot find module './perfil'`).

- [ ] **Step 4: Crear `backend/perfil.js`**

```js
// perfil.js — Validación pura de los datos de perfil del usuario.

const COLOR = /^#[0-9a-fA-F]{6}$/;

function colorValido(valor) {
  return typeof valor === 'string' && COLOR.test(valor);
}

// '+57 300 123-4567' → '573001234567'; ''/null → null (sin WhatsApp); inválido → undefined
function normalizarWhatsapp(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const digitos = String(valor).replace(/[\s+\-().]/g, '');
  return /^\d{8,15}$/.test(digitos) ? digitos : undefined;
}

module.exports = { colorValido, normalizarWhatsapp };
```
Run: `node --test perfil.test.js` → todas pasan.

- [ ] **Step 5: `backend/mailer.js`**

1. Agregar tras la línea `require("dotenv").config();`: `const { colorValido, normalizarWhatsapp } = require("./perfil");`
2. Eliminar la primera definición (código muerto, queda sobrescrita por la segunda): desde la primera línea `function buildHtml({ cliente, suscripcion, nombreVendedor = "SGCRC", color = "#4f46e5" }) {` (la que está antes de `escapeHtml`) hasta la línea `// ... (El resto de enviarCobro se queda igual)` inclusive. Conservar `escapeHtml` y la segunda `buildHtml` (la que sigue al comentario `// Agregamos 'color' a los parámetros`).
3. En la `buildHtml` que queda, reemplazar la firma por
```js
function buildHtml({ cliente, suscripcion, nombreVendedor = "SGCRC", color: colorEntrada = "#4f46e5", whatsapp = null }) {
  const color = colorValido(colorEntrada) ? colorEntrada : "#4f46e5";
```
4. Reemplazar `const frecuencia = (suscripcion.frecuencia || "Mensual").toLowerCase();` por `const frecuencia = escapeHtml((suscripcion.frecuencia || "Mensual").toLowerCase());`
5. Reemplazar el bloque
```js
  // Configuración de WhatsApp
  const mensajeWa = encodeURIComponent(`Hola, envío el comprobante de mi pago de ${tipo} por valor de ${monto}.`);
  const urlWhatsapp = `https://wa.me/573014518350?text=${mensajeWa}`;
```
por
```js
  // WhatsApp del vendedor: sin número válido no se incluye el botón
  const numeroWa = normalizarWhatsapp(whatsapp);
  const bloqueWhatsapp = numeroWa
    ? `<p style="font-size: 14px; color: #6b7280;">Para reportar tu pago de forma rápida, puedes usar el siguiente botón:</p>
        <div class="btn-container">
          <a href="https://wa.me/${numeroWa}?text=${encodeURIComponent(`Hola, envío el comprobante de mi pago de ${suscripcion.tipo} por valor de ${monto}.`)}" class="btn">Reportar Pago por WhatsApp</a>
        </div>`
    : "";
```
(`suscripcion.tipo` sin escapar a propósito: va dentro de `encodeURIComponent`.)
6. En el HTML, reemplazar las líneas
```html
        <p style="font-size: 14px; color: #6b7280;">Para reportar tu pago de forma rápida, puedes usar el siguiente botón:</p>
        
        <div class="btn-container">
          <a href="${urlWhatsapp}" class="btn">Reportar Pago por WhatsApp</a>
        </div>
```
por `        ${bloqueWhatsapp}`.
7. En `enviarCobro`, dentro de la llamada a `buildHtml({ ... })`, agregar `whatsapp: usuarioConfig.whatsapp,` después de `color: colorMarca`.

- [ ] **Step 6: `backend/database.js`, `backend/db.js`**

`database.js`: después de la migración de `color_tema` (`ALTER TABLE usuarios ADD COLUMN color_tema ...`), agregar
```js
// WhatsApp del vendedor para el botón "Reportar pago" de los correos (solo dígitos, con código de país)
try { db.prepare("ALTER TABLE usuarios ADD COLUMN whatsapp TEXT").run(); } catch(e) {}
```
`db.js`, objeto `usuarios`: cambiar el SELECT de `findById` a `SELECT id, email, nombre, color_tema, config_smtp, whatsapp FROM usuarios WHERE id = ?` y agregar después de `updateNombre`:
```js
    updateWhatsapp(id, numero) {
        db.prepare('UPDATE usuarios SET whatsapp = ? WHERE id = ?').run(numero, id);
        return { id, whatsapp: numero };
    }
```
(agregar la coma necesaria tras `updateNombre`).

- [ ] **Step 7: `backend/api.js`**

1. Agregar tras los demás `require`: `const { colorValido, normalizarWhatsapp } = require("./perfil");`
2. En el handler `/usuario/config-tema`, justo después de `const body = await parseBody(req);`, insertar:
```js
      if (body.color_tema && !colorValido(body.color_tema)) {
        return json(res, 400, { error: "El color debe tener el formato #RRGGBB." });
      }
      const whatsapp = body.whatsapp === undefined ? undefined : normalizarWhatsapp(body.whatsapp);
      if (body.whatsapp !== undefined && whatsapp === undefined) {
        return json(res, 400, { error: "El WhatsApp debe tener entre 8 y 15 dígitos, con código de país (ej. 573001234567)." });
      }
```
   y dentro del `try`, después del bloque de `body.nombre`, agregar:
```js
        if (whatsapp !== undefined) {
          db.usuarios.updateWhatsapp(usuario.id, whatsapp);
        }
```
3. Cambiar el mensaje `API de Café Valdore lista` por `API de SGCRC lista`.

- [ ] **Step 8: `backend/auth.js`, `backend/index.js`**

`auth.js`: reemplazar `nombre || 'Café Valdore Admin'` por `nombre || 'Mi negocio'`.
`index.js`: dentro de `main()`, después del banner, agregar
```js
  if (!process.env.JWT_SECRET) {
    console.warn("⚠️  JWT_SECRET no está definido: se usa una clave por defecto del código. Define JWT_SECRET en .env.");
  }
```

- [ ] **Step 9: Ampliar `backend/tests_seguridad.js`**

Antes de `console.log('OK pruebas de seguridad');` agregar:
```js
    // 7. Perfil: color y WhatsApp se validan; el WhatsApp se normaliza y se puede borrar
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
```

- [ ] **Step 10: Scripts de `backend/package.json`**

Cambiar `"test:unit"` a `"node --test cobros.test.js perfil.test.js mailer.test.js"`.

- [ ] **Step 11: `sgcrc-frontend-export/src/views/Configuracion.jsx`**

1. En `guardar`, reemplazar `setStatus({ ok: false, texto: 'Error al guardar' });` por
```js
      setStatus({ ok: false, texto: e.response?.data?.error || e.data?.error || 'Error al guardar' });
```
2. Después del bloque del color (el `<div>` que contiene "Color de Identidad", antes de `{status && (`), insertar:
```jsx
        <div>
          <label htmlFor="whatsapp" className="block text-xs font-bold text-slate-600 uppercase mb-2">WhatsApp para reportar pagos</label>
          <input
            id="whatsapp"
            type="tel"
            inputMode="numeric"
            placeholder="573001234567"
            className="w-full border rounded-xl px-4 py-3 focus:border-brand outline-none"
            value={usuario.whatsapp || ''}
            onChange={e => setUsuario({...usuario, whatsapp: e.target.value})}
          />
          <p className="text-xs text-slate-600 mt-2">Con código de país, sin signos. Si lo dejas vacío, tus correos no incluirán el botón de WhatsApp.</p>
        </div>
```

- [ ] **Step 12: Ejecutar todo**

Desde `backend/`: `npm run test:unit` (perfil + mailer + cobros en verde), `npm run test:security` (`OK pruebas de seguridad`), `npm run test:integration`, `npm test`. Comprobar que no quedan usuarios temporales (consulta del Task 2, Step 7 → `{ n: 0 }`). Desde `sgcrc-frontend-export/`: `npm run build`.
`grep -rn "573014518350\|Café Valdore" backend --include=*.js -l` (excluyendo `node_modules`) → sin resultados.

- [ ] **Step 13: Commit**

```bash
git add backend sgcrc-frontend-export/src/views/Configuracion.jsx
git commit -m "feat(perfil): WhatsApp por usuario, color validado y correo sin datos ajenos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Verificar con `git status` que no se agregan `node_modules` ni archivos `.env`.)

---

### Task 4: Documentación

**Files:**
- Modify: `backend/CLAUDE.md`, `backend/README.md`

- [ ] **Step 1: `backend/CLAUDE.md`**

- En "Gotchas", eliminar el punto sobre `PUT /suscripciones/:id` sin comprobación de propietario (ya corregido).
- En "Cómo agregar un campo a una tabla", agregar un paso 3: "Si el campo se puede editar desde la API, agregarlo a `COLUMNAS` en `db.js` (lista blanca por tabla); sin eso `update` lo ignora."
- En "Notas del scheduler", reemplazar el punto sobre reactivar/`fecha_alta` por: "`suscripciones.cobro_desde` se fija a hoy al crear, reactivar (`activa` 0→1) o cambiar `fecha_alta`; los cobros anteriores a esa fecha no cuentan como vencidos. La API nunca permite fijarlo."
- En la tabla de módulos, agregar `perfil.js` (validación pura de color y WhatsApp).
- Agregar una sección "## Seguridad multi-tenant": "Todo `update`/`delete` de clientes, planes y suscripciones filtra por `usuario_id`; un id ajeno responde 404. `suscripciones` valida que `cliente_id` y `plan_id` sean del usuario. Los nombres de columna de un UPDATE salen de la lista blanca `COLUMNAS`, nunca del cuerpo de la petición. Pruebas: `npm run test:security` (usa usuarios temporales en la base de desarrollo)."
- Agregar a "Configuración": "El botón de WhatsApp de los correos usa `usuarios.whatsapp` (se edita en Configuración); sin número, el correo no lleva botón."

- [ ] **Step 2: `backend/README.md`**

Agregar las novedades equivalentes en el lugar correspondiente: campo `whatsapp` del perfil (`PATCH /usuario/config-tema`), respuesta 404 en `PUT` de recursos ajenos y el script `npm run test:security`.

- [ ] **Step 3: Verificar y commit**

Run: `grep -rn "PUT /suscripciones" backend/CLAUDE.md` → sin la advertencia de propietario.
```bash
git add backend/CLAUDE.md backend/README.md
git commit -m "docs: seguridad multi-tenant, cobro_desde y WhatsApp por usuario

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Criterio de cierre

- `npm run test:unit`, `test:security`, `test:integration` y `npm test` en verde desde `backend/`; `npm run build` en el frontend.
- Ningún `update` interpola nombres de columna que vengan del cliente; ningún `PUT` modifica recursos de otro usuario.
- Reactivar o editar `fecha_alta` no genera correos "vencidos" anteriores a ese momento.
- Los correos no contienen el número de WhatsApp de otra empresa.
- Ningún usuario temporal queda en la base.

## Pendientes que quedan fuera (informados al usuario)

Contraseña mínima y validación de email en el registro, `JWT_SECRET` obligatorio (hoy solo advertencia), CORS abierto, `config_smtp` expuesto en `/usuario/perfil`, y que `procesarCobrosDelDia` marca `Fallido` si el correo salió pero falló el registro en historial.
