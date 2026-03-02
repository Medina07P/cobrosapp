# SGCRC — Backend

Sistema de Gestión de Cobros Recurrentes por Correo.  
Backend minimalista: **Node.js + JSON + Nodemailer + node-cron**. Sin base de datos externa.

---

## 📁 Estructura

```
sgcrc-backend/
├── index.js       ← Punto de entrada
├── db.js          ← Base de datos (archivo JSON)
├── mailer.js      ← Servicio de correo (Nodemailer)
├── scheduler.js   ← Cron job diario
├── api.js         ← API REST
├── .env.example   ← Variables de entorno
└── data/
    └── db.json    ← Se crea automáticamente
```

---

## 🚀 Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar y configurar variables de entorno
cp .env.example .env
# → Editar .env con tus credenciales SMTP

# 3. Iniciar
node index.js
```

---

## ⚙️ Configuración SMTP (Gmail)

1. Ve a tu cuenta Google → **Seguridad** → **Verificación en dos pasos** → actívala.
2. Luego ve a **Contraseñas de aplicación** → genera una para "Correo".
3. Usa esa contraseña en `SMTP_PASS` del archivo `.env`.

Para otros proveedores cambia `SMTP_HOST` y `SMTP_PORT`:

| Proveedor  | Host                    | Puerto |
|------------|-------------------------|--------|
| Gmail      | smtp.gmail.com          | 587    |
| Outlook    | smtp.office365.com      | 587    |
| Yahoo      | smtp.mail.yahoo.com     | 587    |
| SendGrid   | smtp.sendgrid.net       | 587    |

---


### Seguridad opcional de API

Puedes proteger los endpoints administrativos con una llave compartida:

```env
API_KEY=mi_llave_segura
```

Si `API_KEY` está definida, envía el header `X-API-Key` en cada request (excepto `/health`).

También puedes restringir CORS:

```env
CORS_ORIGIN=http://localhost:5173
```

Y exigir conexión SMTP al iniciar:

```env
SMTP_REQUIRED=true
```

## 📡 API REST

Base URL: `http://localhost:3000`

### Clientes
```
GET    /clientes              → Listar todos
POST   /clientes              → Crear  { nombre, correo }
PUT    /clientes/:id          → Editar
DELETE /clientes/:id          → Eliminar
```

### Suscripciones
```
GET    /suscripciones         → Listar todas
POST   /suscripciones         → Crear  { cliente_id, tipo, monto, dia_cobro, descripcion? }
PUT    /suscripciones/:id     → Editar (incluye { activa: false } para cancelar)
```

### Historial
```
GET    /historial             → Listar todos los envíos
```

### Acciones
```
POST   /run                   → Forzar ejecución de cobros ahora (pruebas)
GET    /health                → Estado del servidor
```

---

## 📧 Ejemplos rápidos con curl

```bash
# Crear cliente
curl -X POST http://localhost:3000/clientes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Empresa Alfa","correo":"admin@alfa.co"}'

# Crear suscripción (cobra el día 5 de cada mes)
curl -X POST http://localhost:3000/suscripciones \
  -H "Content-Type: application/json" \
  -d '{"cliente_id":1,"tipo":"Membresía Pro","monto":250000,"dia_cobro":5}'

# Cancelar suscripción
curl -X PUT http://localhost:3000/suscripciones/1 \
  -H "Content-Type: application/json" \
  -d '{"activa":false}'

# Forzar envío manual (prueba)
curl -X POST http://localhost:3000/run
```

---

## ⏰ Scheduler

El sistema ejecuta automáticamente los cobros **cada día a la hora configurada** en `.env`:

```
CRON_HORA=08
CRON_MIN=00
```

Lógica:
- Obtiene todas las suscripciones activas.
- Filtra las que tienen `dia_cobro` = día de hoy.
- Meses cortos (Feb, etc.): si `dia_cobro > días del mes`, se procesa el último día.
- Envía el correo y registra el resultado en el historial.

---

## 🔒 Notas de seguridad

- El archivo `.env` **nunca** debe subirse a git. Agrega `.env` a tu `.gitignore`.
- Los datos se guardan en `data/db.json`. Haz backup periódico de ese archivo.
- Para producción, considera migrar a PostgreSQL (solo cambia `db.js`).
