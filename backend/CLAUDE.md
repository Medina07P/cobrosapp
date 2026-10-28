# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Subproyecto: Backend

Node.js HTTP nativo + SQLite + nodemailer + node-cron. Sin framework HTTP (no Express).

## Comandos

```bash
npm run dev    # Desarrollo: node --watch index.js, puerto 3000
npm start      # Producción: node index.js
npm test       # Smoke test con JWT (ver tests_api_smoke.js)
npm run test:unit        # cobros + perfil + mailer (sin base de datos)
npm run test:security    # aislamiento entre usuarios, inyección, validación, cobro_desde, perfil
npm run test:integration # scheduler con usuario temporal y correo simulado
node check_db.js   # Inspeccionar tablas y datos en la consola
node migrar.js     # Migración one-shot desde db.json legado (solo para datos históricos)
```

## Módulos y responsabilidades

| Archivo | Rol |
|---|---|
| `index.js` | Entry point: verifica SMTP, arranca scheduler, arranca API |
| `api.js` | Router HTTP: un `if/else if` por endpoint, verifica JWT antes de despachar |
| `auth.js` | Registro y login: bcrypt hash + JWT sign (HS256) con `expiresIn: '24h'` |
| `database.js` | Instancia `better-sqlite3`, define DDL de las 5 tablas, aplica migraciones `ALTER TABLE` |
| `db.js` | Capa repositorio: objetos `clientes`, `planes`, `suscripciones`, `historial`, `usuarios` |
| `scheduler.js` | Cron diario con `node-cron`, función `procesarCobrosDelDia()`, mutex `procesandoCobros` |
| `cobros.js` | Reglas puras de fechas de cobro: `tocaCobrarEn`, detección de vencidos y `planificarCobros` (tests: `npm run test:unit`) |
| `perfil.js` | Validadores puros del perfil: color `#RRGGBB` y WhatsApp (solo dígitos, 8–15, con código de país); contraste WCAG (`ratioContraste`, `textoSobre`, `colorLegibleSobreBlanco`, mismo algoritmo que el frontend). Tests: `npm run test:unit` |
| `mailer.js` | Construye HTML del correo (con `escapeHtml`; texto del botón y color del monto según contraste con el color de marca), envía vía SMTP por usuario o global |
| `migrar.js` | Script one-shot para migrar datos desde `data/db.json` (formato anterior) a SQLite |
| `check_db.js` | CLI para inspeccionar tablas y ver muestras de datos |
| `tests_api_smoke.js` | Smoke test: registra usuario temporal, obtiene JWT, verifica endpoints clave |

## Cómo agregar un endpoint

1. En `db.js`, agregar el objeto con métodos `all/find/create/update/delete` filtrando por `usuarioId`.
2. En `api.js`, agregar un bloque `if (pathname.startsWith("/recurso"))` **después** de la verificación JWT (línea ~99). Usar `obtenerUsuario(req)` para obtener `usuario.id`.
3. Patrón de referencia: ver cualquier bloque existente (`/clientes`, `/planes`, `/suscripciones`).

## Cómo agregar un campo a una tabla

1. En `database.js`, la sentencia `CREATE TABLE IF NOT EXISTS` ya define la estructura inicial.
2. Al final del archivo (después del bloque de comentario `--- BLOQUE DE MIGRACIÓN SEGURO ---`), agregar:
   ```js
   try { db.prepare("ALTER TABLE tabla ADD COLUMN nuevo_campo TIPO").run(); } catch(e) {}
   ```
   Esto permite que instancias existentes se actualicen sin error.
3. Si el campo se puede editar desde la API, agregarlo a `COLUMNAS` en `db.js` (lista blanca por tabla) y a los validadores de `create`/`update` de esa tabla; sin eso `update` lo ignora o la validación lo rechaza.

## Configuración SMTP

- **Global**: variables `SMTP_HOST/PORT/USER/PASS/FROM` en `.env`.
- **Por usuario**: campo `usuarios.config_smtp` en DB (JSON string). `mailer.js` lo parsea y lo usa si existe; si no, cae al global.
- Para Gmail: crear una "Contraseña de aplicación" (no la contraseña de la cuenta) con 2FA activo.

- **WhatsApp**: el botón de WhatsApp de los correos usa `usuarios.whatsapp` (solo dígitos, 8–15, con código de país). Se edita en Configuración vía `PATCH /usuario/config-tema`; sin número, el correo no lleva botón.

## Notas del scheduler

- Hora por defecto: 08:00 America/Bogota. Configurable con `CRON_HORA` y `CRON_MIN` en `.env`.
- La decisión de qué enviar vive en `cobros.js` (`planificarCobros`), no en `scheduler.js`. `tocaCobrarEn(sus, fecha)` prioriza `fecha_alta` sobre `dia_cobro` del plan.
- **Cobros vencidos:** el cron envía los cobros de hoy y reintenta los vencidos (día de cobro pasado sin envío `Enviado` en esa fecha o después) durante `COBROS_REINTENTO_DIAS` días (7 por defecto; 0 = solo hoy). Más allá de la ventana el cobro es "perdido": no se envía, solo aparece en `GET /cobros/resumen`.
- **Rebotes permanentes:** `mailer.esReboteDireccion()` reconoce el 5.1.x (dirección inexistente) y el scheduler guarda `clientes.correo_rebotado`. Mientras esa columna coincida con `correo`, el cliente se omite en el cron y en `/run-individual`; la marca se limpia sola cuando el correo cambia. La UI no lo muestra, así que un cliente que "no recibe nada" puede estar en este estado.
- Idempotencia en `/run` (endpoint manual): responde 409 solo cuando no hay nada nuevo que enviar y sí hay cobros de hoy ya enviados; entonces requiere `{ confirmarReenvio: true }`.
- `suscripciones.cobro_desde` se fija a hoy al crear, al reactivar (`activa` 0→1), al cambiar `fecha_alta`, al cambiar de plan (`plan_id`) y, para todas las suscripciones del usuario a un plan, cuando cambia realmente su `frecuencia` o `dia_cobro`. Las reglas de `cobros.js` ignoran vencimientos anteriores a `cobro_desde`. La API nunca permite fijarlo. Cambiar el día de `fecha_alta` después de enviar el cobro del periodo puede producir un segundo cobro en el mismo periodo.
- `COBROS_REINTENTO_DIAS=0` no muestra vencidos en `GET /cobros/resumen`: los cobros pasados sin enviar figuran en `perdidos`.
- El mutex `procesandoCobros` es en memoria: no protege contra múltiples procesos Node.js.
- Pruebas: `npm run test:unit` (lógica de fechas), `npm run test:integration` (scheduler con usuario temporal en la base de desarrollo y correo simulado), `npm test` (smoke de la API). Ninguna debe ejecutarse contra producción.

## Gotchas

- `JWT_SECRET` es obligatorio (`config.js`): sin él el servidor no arranca (sale con código 1) y `api.js`/`auth.js` fallan. Ya no existe clave por defecto. Despliegue: definirlo en `.env` antes de desplegar; los tokens firmados con la clave por defecto anterior quedan inválidos, y si el secreto cambia todos los usuarios deben iniciar sesión de nuevo.
- El smoke test (`npm test`) usa un email con timestamp para no colisionar en re-ejecuciones, pero deja datos de prueba en la DB real. No ejecutar en producción.
- `database.js` usa siempre `data/sgcrc.db` (ignora `DB_PATH`): en el servidor, las pruebas `npm test` y `npm run test:integration` escribirían en la base de producción. No ejecutarlas allí.
- El log `"✅ Base de datos refactorizada..."` aparece duplicado en `database.js:108-110` (líneas 108 y 110 son iguales; no afecta comportamiento).

## Seguridad multi-tenant

- Todo `update`/`delete` de clientes, planes y suscripciones filtra por `usuario_id`; un id ajeno responde 404.
- `db.js` valida de forma estricta `create`/`update` (error `VALIDATION_ERROR` → 400 con mensaje en español). `suscripciones` verifica que `cliente_id` y `plan_id` sean del usuario.
- Los nombres de columna de un UPDATE salen de la lista blanca `COLUMNAS`, nunca del cuerpo de la petición.
- Errores: validación → 400; cualquier otro → 500 genérico `Error interno del servidor` (el detalle solo va al log). JSON malformado o cuerpo que no es objeto → 400.
- `GET /usuario/perfil` devuelve solo `id, email, nombre, color_tema, whatsapp` (nunca password ni `config_smtp`). `PATCH /usuario/config-tema` (`nombre`, `color_tema` `#RRGGBB`, `whatsapp`) se valida y escribe en una transacción.
- Pruebas: `npm run test:security` (usuarios temporales en la base de desarrollo; nunca en producción).

## Problemas conocidos

- Sin política de contraseña ni validación de email en el registro.
- CORS abierto (`*`).
- Sin límite de tamaño del cuerpo de la petición.
- El registro permite enumerar emails (responde "El email ya existe").
- `procesarCobrosDelDia` registra `Fallido` si el correo salió pero falló la escritura en historial; un reintento puede duplicar el envío.
