# Documentación Técnica: Arquitectura del Sistema de Cobros (SGCRC)

*Versión: 2026-05-25*

## 1. Introducción

El presente documento describe la arquitectura de software del sistema "SGCRC" (Sistema de Gestión de Cobros Recurrentes), diseñado para automatizar el envío de recordatorios de cobro y la gestión de suscripciones de clientes recurrentes. El caso de uso principal es el negocio Café Valdore.

## 2. Arquitectura de Red

El servidor corre en una máquina local Ubuntu ubicada en la Vereda Miravalle con conectividad via Starlink. Para exponer el dashboard de forma segura sin abrir puertos en el router, se utiliza un túnel **Cloudflare Tunnel** que enruta el tráfico HTTPS externo al servidor local. Esto elimina la necesidad de IP fija o configuración de firewall.

```
Usuario remoto → HTTPS → Cloudflare → Túnel → Servidor local Ubuntu
```

## 3. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend runtime | Node.js (HTTP nativo, sin Express) |
| Base de datos | SQLite con `better-sqlite3` (modo WAL) |
| Autenticación | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| Correo | Nodemailer (SMTP, configurado para Gmail) |
| Scheduler | `node-cron` (timezone America/Bogota) |
| Gestor de procesos | PM2 (modo fork, instancia única) |
| Frontend | React 18 + Vite |
| Estilos | Tailwind CSS (CDN) |

## 4. Modelo de Datos (SQLite)

La base de datos reside en `backend/data/sgcrc.db` con foreign keys habilitadas.

```
usuarios
├── id, email (UNIQUE), password (hash bcrypt), nombre
├── config_smtp (JSON string, SMTP por usuario)
└── color_tema (hex, default #4f46e5)

clientes
├── id, nombre, correo
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
3. `tocaCobrarHoy()` determina si cada suscripción corresponde al día actual según su frecuencia (`mensual`, `quincenal`, `semanal`, `anual`) y `fecha_alta`.
4. Se omiten las suscripciones ya enviadas en el día (idempotencia).
5. Para cada suscripción elegible: `mailer.enviarCobro()` genera y envía el HTML del correo.
6. Se registra el resultado (`Enviado` o `Fallido`) en la tabla `historial`.

## 7. Referencias

- Node.js HTTP module documentation
- better-sqlite3 documentation
- Cloudflare Tunnel documentation
- IEEE Standards for Software Engineering Documentation
