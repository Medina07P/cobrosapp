# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Subproyecto: Backend

Node.js HTTP nativo + SQLite + nodemailer + node-cron. Sin framework HTTP (no Express).

## Comandos

```bash
npm run dev    # Desarrollo: node --watch index.js, puerto 3000
npm start      # Producción: node index.js
npm test       # Smoke test con JWT (ver tests_api_smoke.js)
node check_db.js   # Inspeccionar tablas y datos en la consola
node migrar.js     # Migración one-shot desde db.json legado (solo para datos históricos)
```

## Módulos y responsabilidades

| Archivo | Rol |
|---|---|
| `index.js` | Entry point: verifica SMTP, arranca scheduler, arranca API |
| `api.js` | Router HTTP: un `if/else if` por endpoint, verifica JWT antes de despachar |
| `auth.js` | Registro y login: bcrypt hash + JWT sign con `expiresIn: '24h'` |
| `database.js` | Instancia `better-sqlite3`, define DDL de las 5 tablas, aplica migraciones `ALTER TABLE` |
| `db.js` | Capa repositorio: objetos `clientes`, `planes`, `suscripciones`, `historial`, `usuarios` |
| `scheduler.js` | Cron diario con `node-cron`, función `tocaCobrarHoy()`, mutex `procesandoCobros` |
| `mailer.js` | Construye HTML del correo (con `escapeHtml`), envía vía SMTP por usuario o global |
| `migrar.js` | Script one-shot para migrar datos desde `data/db.json` (formato anterior) a SQLite |
| `check_db.js` | CLI para inspeccionar tablas y ver muestras de datos |
| `tests_api_smoke.js` | Smoke test: registra usuario temporal, obtiene JWT, verifica endpoints clave |

## Cómo agregar un endpoint

1. En `db.js`, agregar el objeto con métodos `all/find/create/update/delete` filtrando por `usuarioId`.
2. En `api.js`, agregar un bloque `if (pathname.startsWith("/recurso"))` **después** de la verificación JWT (línea ~76). Usar `obtenerUsuario(req)` para obtener `usuario.id`.
3. Patrón de referencia: ver cualquier bloque existente (`/clientes`, `/planes`, `/suscripciones`).

## Cómo agregar un campo a una tabla

1. En `database.js`, la sentencia `CREATE TABLE IF NOT EXISTS` ya define la estructura inicial.
2. Al final del archivo (después del bloque de comentario `--- BLOQUE DE MIGRACIÓN SEGURO ---`), agregar:
   ```js
   try { db.prepare("ALTER TABLE tabla ADD COLUMN nuevo_campo TIPO").run(); } catch(e) {}
   ```
   Esto permite que instancias existentes se actualicen sin error.

## Configuración SMTP

- **Global**: variables `SMTP_HOST/PORT/USER/PASS/FROM` en `.env`.
- **Por usuario**: campo `usuarios.config_smtp` en DB (JSON string). `mailer.js` lo parsea y lo usa si existe; si no, cae al global.
- Para Gmail: crear una "Contraseña de aplicación" (no la contraseña de la cuenta) con 2FA activo.

## Notas del scheduler

- Hora por defecto: 08:00 America/Bogota. Configurable con `CRON_HORA` y `CRON_MIN` en `.env`.
- `tocaCobrarHoy()` prioriza `fecha_alta` sobre `dia_cobro` del plan para calcular el día base.
- Idempotencia en `/run` (endpoint manual): si ya hay envíos del día, requiere `{ confirmarReenvio: true }` en el body.
- El mutex `procesandoCobros` es en memoria: no protege contra múltiples procesos Node.js.

## Gotchas

- `JWT_SECRET` tiene fallback hardcodeado en `api.js:7` y `auth.js:5`. Siempre setear en `.env`.
- El smoke test (`npm test`) usa un email con timestamp para no colisionar en re-ejecuciones, pero deja datos de prueba en la DB real. No ejecutar en producción.
- El log `"✅ Base de datos refactorizada..."` aparece duplicado en `database.js:108-110` (líneas 108 y 110 son iguales; no afecta comportamiento).
