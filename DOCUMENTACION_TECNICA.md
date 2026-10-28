# Documentación Técnica: Arquitectura del Sistema de Cobros (SGCRC)

*Versión: 2026-10-28*

## 1. Introducción

El presente documento describe la arquitectura de software del sistema "SGCRC" (Sistema de Gestión de Cobros Recurrentes), diseñado para automatizar el envío de recordatorios de cobro y la gestión de suscripciones de clientes recurrentes. El caso de uso principal es el negocio Café Valdore.

## 2. Arquitectura de Red

La aplicación corre en una VPS con Docker Compose. El stack **no publica puertos en el host**: los dos contenedores de SGCRC viven en una red interna y el contenedor de Caddy que ya existe en la VPS los alcanza por una red Docker compartida (`sgcrc`). Caddy termina TLS y emite el certificado del dominio.

```
Usuario remoto → HTTPS → Caddy (contenedor, 80/443) → sgcrc-web (nginx, 80) → sgcrc-api (Node, 3000)
```

Ningún puerto del host pertenece a SGCRC, así que convive con los demás servicios de la VPS sin colisiones. El detalle operativo —primer despliegue, conexión de Caddy, migración de la base y backups— está en [`docs/despliegue-docker.md`](docs/despliegue-docker.md).

## 3. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend runtime | Node.js (HTTP nativo, sin Express) |
| Base de datos | SQLite con `better-sqlite3` (modo WAL) |
| Autenticación | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| Correo | Nodemailer (SMTP, configurado para Gmail) |
| Scheduler | `node-cron` (timezone America/Bogota) |
| Contenedores | Docker Compose: Node 22 (`sgcrc-api`) + nginx 1.27 (`sgcrc-web`) |
| Proxy y TLS | Caddy, en un contenedor que ya existía en la VPS |
| Frontend | React 18 + Vite |
| Estilos | CSS propio (`src/styles/`, tokens y reset) |

## 4. Modelo de Datos (SQLite)

La base reside en `backend/data/sgcrc.db` en local y en el volumen `sgcrc_data` (montado en `/app/data/sgcrc.db`) dentro del contenedor. La ruta es fija en `backend/database.js`: la variable `DB_PATH` del `.env.example` no se lee. Foreign keys habilitadas.

```
usuarios
├── id, email (UNIQUE), password (hash bcrypt), nombre
├── config_smtp (JSON string, SMTP por usuario)
└── color_tema (hex, default #1F6B4F, `COLOR_POR_DEFECTO` en `backend/perfil.js`)

clientes
├── id, nombre, correo
├── correo_rebotado (copia del correo que rebotó de forma permanente; si coincide con `correo`, no se le envía)
└── usuario_id → usuarios(id) CASCADE

planes  ← catálogo reutilizable
├── id, nombre_plan, monto, frecuencia, dia_cobro, descripcion
└── usuario_id → usuarios(id) CASCADE

suscripciones
├── id, activa, fecha_alta, descripcion
├── cliente_id → clientes(id) RESTRICT
├── plan_id    → planes(id)   RESTRICT
└── usuario_id → usuarios(id) CASCADE

historial
├── id, fecha, monto, estado (Enviado/Fallido), detalles
├── suscripcion_id → suscripciones(id) CASCADE
└── usuario_id     → usuarios(id)      CASCADE
```

Las migraciones se aplican como sentencias `ALTER TABLE … try/catch` en `backend/database.js`.

## 5. Flujo de Autenticación

1. El usuario hace `POST /auth/login` con `{ email, password }`.
2. El backend verifica el hash bcrypt y emite un **JWT** firmado con `JWT_SECRET` (expira en 24h).
3. El frontend guarda el token en `localStorage` (clave `sgcrc_session`).
4. Cada request posterior incluye `Authorization: Bearer <token>`.
5. El backend verifica el token con `jwt.verify` antes de despachar cualquier ruta protegida.
6. Todos los datos del usuario se filtran por `usuario_id` extraído del JWT (multi-tenant).

## 6. Flujo de Cobros Diarios

1. `node-cron` dispara `procesarCobrosDelDia()` a las 08:00 America/Bogota (configurable).
2. Se obtienen todas las suscripciones activas del usuario.
3. `tocaCobrarEn()` / `planificarCobros()` (`backend/cobros.js`) determinan si cada suscripción corresponde al día actual según su frecuencia (`mensual`, `quincenal`, `semanal`, `anual`) y `fecha_alta`. También incluyen los cobros vencidos sin enviar hasta `COBROS_REINTENTO_DIAS` días atrás (7 por defecto; `0` = solo los de hoy).
4. Se omiten las suscripciones ya enviadas en el día (idempotencia) y los clientes cuyo `correo_rebotado` coincide con su `correo` actual.
5. Para cada suscripción elegible: `mailer.enviarCobro()` envía el correo con versión HTML y alternativa en texto plano.
6. Se registra el resultado (`Enviado` o `Fallido`) en la tabla `historial`.
7. Si el fallo es un rebote permanente de dirección (SMTP 5.1.x), se guarda `clientes.correo_rebotado`: ese cliente queda omitido en los envíos siguientes hasta que se corrija su correo.

## 7. Referencias

- Node.js HTTP module documentation
- better-sqlite3 documentation
- Docker Compose documentation
- Caddy documentation
- IEEE Standards for Software Engineering Documentation
