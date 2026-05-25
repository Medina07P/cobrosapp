# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visión general

SGCRC (Sistema de Gestión de Cobros Recurrentes) es una app fullstack JavaScript que automatiza el envío de recordatorios de cobro por correo electrónico. El backend usa Node.js con el módulo `http` nativo (sin Express), SQLite (`better-sqlite3`) y un scheduler `node-cron`. El frontend es una SPA en React 18 + Vite que enruta por estado (sin React Router). El sistema está desplegado en un servidor Ubuntu local con conectividad Starlink, expuesto mediante un túnel Cloudflare.

## Estructura del repositorio

```
programa/
├── backend/                    ← API REST + scheduler + mailer + SQLite
└── sgcrc-frontend-export/      ← Dashboard SPA React + Vite
```

Cada subproyecto tiene su propio `package.json`; se deben instalar dependencias por separado.

## Comandos de desarrollo

```bash
# Backend (desarrollo con auto-reload nativo, puerto 3000)
cd backend && npm run dev

# Backend (producción vía PM2)
pm2 restart sgcrc-backend

# Smoke test del backend
cd backend && npm test

# Frontend (servidor Vite, puerto 5173, proxy /api → :3000)
cd sgcrc-frontend-export && npm run dev

# Frontend (build de producción)
cd sgcrc-frontend-export && npm run build
# Luego copiar al servidor: sudo cp -r dist/* /var/www/cobrosapp/frontend/
```

No hay linter configurado (sin ESLint/Prettier). No hay framework de tests formal, solo el smoke test (`tests_api_smoke.js`).

## Arquitectura

### Multi-tenant

Cada operación de datos filtra por `usuario_id`. El `usuario_id` viene del JWT que `api.js:obtenerUsuario()` verifica con `jwt.verify`. **Toda ruta nueva debe respetar este patrón**: obtener `usuario.id` del JWT verificado y pasarlo a la capa repositorio.

### Router HTTP imperativo

`backend/api.js` despacha con un `switch` implícito (`if/else if`) sobre `pathname + method`. No hay Express ni framework HTTP. Para agregar un endpoint:
1. Agregar los métodos del recurso en `backend/db.js` (capa repositorio).
2. Registrar el bloque `if (pathname.startsWith("/recurso"))` en `api.js` después de la verificación JWT (línea ~76).

### Migraciones de base de datos

El DDL está en `backend/database.js`. Las migraciones se hacen con bloques `try { db.prepare("ALTER TABLE ...").run(); } catch(e) {}` al final del archivo. No hay Knex ni Prisma: para agregar un campo, añadir un bloque `ALTER TABLE` ahí.

### Scheduler de cobros

`backend/scheduler.js` ejecuta `procesarCobrosDelDia()` diariamente a la hora configurada. `tocaCobrarHoy()` decide por frecuencia (`mensual`, `quincenal`, `semanal`, `anual`) usando `fecha_alta` como fecha base cuando está disponible. Hay un mutex booleano `procesandoCobros` para evitar concurrencia.

### Frontend SPA

`App.jsx` enruta por el estado `view` usando un objeto `VIEWS`. El tema visual se aplica con CSS custom properties (`--color-primario`, `--color-primario-glow`) que se actualizan en runtime al cambiar `color_tema` del usuario. Los componentes deben usar esas variables, no colores hardcodeados.

## Configuración

El archivo `backend/.env` (nunca versionado) debe tener:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=correo@gmail.com
SMTP_PASS=app_password
SMTP_FROM="Nombre <correo@gmail.com>"
PORT=3000
CRON_HORA=08
CRON_MIN=00
JWT_SECRET=una_clave_larga_y_aleatoria   # Obligatorio — ver gotchas
```

Ver `backend/.env.example` para referencia (le faltan `JWT_SECRET`, `CORS_ORIGIN`, `SMTP_REQUIRED`).

## Gotchas importantes

- **JWT_SECRET sin setear**: `api.js:7` y `auth.js:5` tienen el fallback hardcodeado `'clave_maestra_super_secreta_123'`. Si `JWT_SECRET` no está en `.env`, tokens de cualquier instancia son válidos. Siempre configurar.
- **CORS abierto**: `api.js` usa `Access-Control-Allow-Origin: *` fijo. La variable `CORS_ORIGIN` del `.env.example` no está implementada en el código actual.
- **Tailwind por CDN**: el frontend carga Tailwind desde CDN en `index.html`. No hay `tailwind.config.js` ni PostCSS — no agregar configuración local esperando que funcione.
- **`axios` en `package.json` pero no usado**: el código del frontend usa `fetch` en `src/api.js`. No mezclar los dos.
- **Carpetas vacías**: `backend/auth/login/` y `backend/auth/register/` son restos de un refactor anterior, no tienen contenido.
