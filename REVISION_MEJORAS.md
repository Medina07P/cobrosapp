# Revisión de mejoras — SGCRC (CobrosApp)

*Última revisión: 2026-05-25*

---

## Estado de los hallazgos

### ✅ RESUELTO — 1. Autenticación y autorización

Todas las rutas administrativas (`/clientes`, `/planes`, `/suscripciones`, `/historial`, `/run`, etc.) están protegidas con JWT. El flujo completo (`POST /auth/register`, `POST /auth/login`) emite tokens con `expiresIn: '24h'`. Implementado en `auth.js` y verificado en `api.js:obtenerUsuario()`.

**Pendiente menor:** El `JWT_SECRET` tiene un fallback hardcodeado (`'clave_maestra_super_secreta_123'`) en `api.js:7` y `auth.js:5`. Siempre definir `JWT_SECRET` en `.env` en producción.

---

### ⚠️ PENDIENTE — 2. Validaciones de entrada básicas e incompletas

Los endpoints aceptan campos con formato inválido (correos malformados, montos negativos, `dia_cobro` fuera de rango). Solo `/suscripciones POST` valida campos obligatorios. Se recomienda una capa de validación en `api.js` o en `db.js` antes de ejecutar el SQL.

---

### ✅ RESUELTO — 3. Persistencia JSON con operaciones síncronas

La base de datos fue migrada de `data/db.json` + `fs.readFileSync/writeFileSync` a **SQLite con `better-sqlite3`** (modo WAL, foreign keys habilitadas). El script de migración one-shot está en `backend/migrar.js`.

---

### ✅ PARCIALMENTE RESUELTO — 4. Riesgo de ejecución concurrente de cobros

Se agregó el mutex booleano `procesandoCobros` en `scheduler.js` y el endpoint `/run` retorna `409` si hay una ejecución en curso. También se implementó idempotencia: si ya hubo envíos en el día, se requiere `{ confirmarReenvio: true }` para reenviar.

**Limitación:** El mutex es en memoria. Si hay múltiples instancias del proceso Node.js corriendo (ej., PM2 en cluster mode), no hay protección entre procesos. Usar `pm2 start --instances 1` (modo fork, no cluster).

---

### ⚠️ PENDIENTE — 5. Conectividad SMTP no bloqueante al iniciar

La app verifica SMTP en `index.js` al arrancar, pero si falla solo muestra advertencia y continúa. Con `SMTP_REQUIRED=true` en `.env` sí falla el proceso. Se recomienda activar `SMTP_REQUIRED=true` en producción para detectar errores de configuración antes de que fallen cobros silenciosamente.

---

### ✅ RESUELTO — 6. Posible inyección HTML en correos

Se implementó la función `escapeHtml` en `mailer.js` que sanitiza `cliente.nombre`, `suscripcion.tipo`, `suscripcion.descripcion` y otros campos de usuario antes de interpolarlos en el HTML del correo.

---

### ⚠️ PENDIENTE — 7. Cálculo de próximos cobros simplificado en frontend

El dashboard usa el valor `31` fijo para calcular rollover mensual, lo cual puede dar proyecciones incorrectas para meses de 28, 29 o 30 días. Usar `new Date(año, mes + 1, 0).getDate()` para obtener el número real de días del mes.

---

### ⚠️ PENDIENTE — 8. Suite de pruebas automatizadas

Existe un smoke test en `backend/tests_api_smoke.js` (alineado con JWT desde 2026-05-25), pero no hay pruebas de unidad para la lógica del scheduler (`tocaCobrarHoy`), ni pruebas de integración para casos críticos (cobro en último día del mes, frecuencia anual, etc.). No hay tests en el frontend.

---

### ⚠️ PENDIENTE — 9. Observabilidad limitada

No hay logging estructurado ni métricas. Los errores van a `console.error`. Se recomienda: al menos un log estructurado (JSON) por cobro procesado con campos `usuario_id`, `suscripcion_id`, `estado`, `duracion_ms`.

---

### ⚠️ PENDIENTE — 10. Configuración CORS abierta

`api.js` usa `Access-Control-Allow-Origin: *` fijo. La variable `CORS_ORIGIN` mencionada en `.env.example` no está implementada en el código. Para producción, restringir a los dominios permitidos.

---

## Prioridad recomendada (pendientes)

1. **Alta:** Configurar `JWT_SECRET` real en `.env` (riesgo de seguridad activo).
2. **Alta:** Activar `SMTP_REQUIRED=true` para detectar fallos de SMTP al arrancar.
3. **Media:** Validación de entradas (correo, monto, dia_cobro) en endpoints.
4. **Media:** Restringir CORS a origen de producción.
5. **Baja:** Tests para `tocaCobrarHoy()` y casos de borde del scheduler.
6. **Baja:** Corrección de cálculo de días en Dashboard.
