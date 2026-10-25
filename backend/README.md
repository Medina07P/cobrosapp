# SGCRC — Backend

Sistema de Gestión de Cobros Recurrentes por Correo.  
Backend minimalista: **Node.js HTTP nativo + SQLite (`better-sqlite3`) + Nodemailer + node-cron**.

---

## Instalación

```bash
npm install
cp .env.example .env
# Editar .env con credenciales SMTP y JWT_SECRET
node index.js
```

---

## Variables de entorno

```env
# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=correo@gmail.com
SMTP_PASS=contraseña_de_aplicacion
SMTP_FROM="Nombre <correo@gmail.com>"

# Servidor
PORT=3000

# Scheduler (hora local Colombia)
CRON_HORA=08
CRON_MIN=00

# Seguridad — OBLIGATORIO: el servidor no arranca sin JWT_SECRET (sin clave por defecto).
# Generar: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# Al desplegar, defínelo antes; si cambia, los tokens anteriores quedan inválidos y todos deben iniciar sesión de nuevo.
JWT_SECRET=clave_larga_y_aleatoria_aqui

# Opcionales
SMTP_REQUIRED=true          # Falla al arrancar si SMTP no conecta
```

Para Gmail: activar 2FA y crear una "Contraseña de aplicación" (no usar la contraseña de la cuenta).

| Proveedor  | Host                    | Puerto |
|------------|-------------------------|--------|
| Gmail      | smtp.gmail.com          | 587    |
| Outlook    | smtp.office365.com      | 587    |
| Yahoo      | smtp.mail.yahoo.com     | 587    |
| SendGrid   | smtp.sendgrid.net       | 587    |

---

## Autenticación

Todas las rutas excepto `/auth/login`, `/auth/register` y `/health` requieren:

```
Authorization: Bearer <token_jwt>
```

El token se obtiene con `POST /auth/login` y expira en 24 horas.

---

## API REST

Base URL: `http://localhost:3000`

### Auth (públicas)
```
POST  /auth/register   → { email, password, nombre }  →  { id, message }
POST  /auth/login      → { email, password }           →  { token, user }
GET   /health          → { status: "ok" }
```

### Clientes
```
GET    /clientes           → Listar todos del usuario autenticado
POST   /clientes           → Crear  { nombre, correo }
PUT    /clientes/:id        → Editar campos
DELETE /clientes/:id        → Eliminar (falla si tiene suscripciones activas)
```

### Planes (catálogo reutilizable)
```
GET    /planes              → Listar todos del usuario
POST   /planes              → Crear  { nombre_plan, monto, frecuencia, dia_cobro, descripcion? }
PUT    /planes/:id           → Editar campos
DELETE /planes/:id           → Eliminar (falla si hay suscripciones vinculadas)
```

Errores comunes: `400` con mensaje en español si un valor no es válido (también JSON malformado o cuerpo que no es un objeto); `404` si el id no existe **o pertenece a otro usuario** (en `PUT` y `DELETE`); cualquier otro fallo responde `500 Error interno del servidor` sin detalles. `cobro_desde` de las suscripciones lo gestiona el servidor (se fija a hoy al crear, reactivar, cambiar `fecha_alta` o cambiar de plan) y no se puede enviar.

Valores de `frecuencia`: `mensual` (default), `quincenal`, `semanal`, `anual`.

### Suscripciones
```
GET    /suscripciones        → Listar todas (incluye datos del plan y cliente por JOIN)
POST   /suscripciones        → Crear  { cliente_id, plan_id, descripcion?, fecha_alta? }
PUT    /suscripciones/:id     → Editar  (usa { activa: false } para cancelar)
DELETE /suscripciones/:id     → Eliminar
```

### Historial
```
GET    /historial            → Listar todos los envíos del usuario (orden desc por fecha)
```

### Perfil de usuario
```
GET    /usuario/perfil                    → Datos del usuario (sin password)
PATCH  /usuario/config-tema               → { nombre?, color_tema?, whatsapp? }  (POST también se acepta)
```

`GET /usuario/perfil` devuelve solo `id, email, nombre, color_tema, whatsapp` (nunca password ni `config_smtp`).  
`color_tema` debe ser `#RRGGBB`. `whatsapp` son solo dígitos (8–15, con código de país, p. ej. `573001234567`); vacío o `null` lo borra y los correos salen sin botón de WhatsApp. Los datos se validan y se guardan en una sola transacción.

### Cobros
```
POST   /run                  → Ejecutar cobros del día para el usuario autenticado
                               Body: { confirmarReenvio: true } para forzar reenvíos del mismo día
POST   /run-individual       → { ids: [1, 2, 3] }  →  Cobrar suscripciones específicas
```

---

## Ejemplos con curl

```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cafe.co","password":"mi_clave"}' | jq -r '.token')

# Listar clientes
curl http://localhost:3000/clientes -H "Authorization: Bearer $TOKEN"

# Crear cliente
curl -X POST http://localhost:3000/clientes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nombre":"Empresa Alfa","correo":"admin@alfa.co"}'

# Crear plan
curl -X POST http://localhost:3000/planes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nombre_plan":"Membresía Pro","monto":250000,"frecuencia":"mensual","dia_cobro":5}'

# Crear suscripción
curl -X POST http://localhost:3000/suscripciones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cliente_id":1,"plan_id":1}'

# Cancelar suscripción
curl -X PUT http://localhost:3000/suscripciones/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"activa":false}'

# Forzar cobros del día
curl -X POST http://localhost:3000/run \
  -H "Authorization: Bearer $TOKEN"
```

---

## Scheduler

Ejecuta `procesarCobrosDelDia()` cada día a la hora configurada (timezone `America/Bogota`).

- `cobros.js` (`tocaCobrarEn` y `planificarCobros`) usa `fecha_alta` como día base si existe; de lo contrario, usa `dia_cobro` del plan.
- Cobros vencidos: el scheduler reintenta cada día los cobros pasados sin enviar hasta `COBROS_REINTENTO_DIAS` días (7 por defecto).
- Los envíos ya procesados en el día se omiten para evitar duplicados (idempotencia).
- El endpoint `/run` responde 409 y requiere `{ confirmarReenvio: true }` solo cuando no hay nada nuevo que enviar y sí hay cobros de hoy ya enviados.
- El mutex `procesandoCobros` evita ejecuciones concurrentes del mismo proceso.

---

## Base de datos

SQLite en `backend/data/sgcrc.db` (modo WAL, foreign keys ON).

Tablas: `usuarios`, `clientes`, `planes`, `suscripciones`, `historial`.  
Migraciones defensivas en `database.js` mediante bloques `ALTER TABLE … try/catch`.

---

## Pruebas

```bash
npm run test:unit         # cobros + perfil + mailer (sin base de datos)
npm run test:security     # aislamiento entre usuarios, inyección, validación, cobro_desde, perfil
npm run test:integration  # scheduler con correo simulado
npm test                  # smoke de la API
```

**Advertencia:** `test:security`, `test:integration` y `npm test` crean usuarios temporales en la base de desarrollo `data/sgcrc.db` (`database.js` ignora `DB_PATH`). No ejecutarlos nunca en el servidor de producción.
