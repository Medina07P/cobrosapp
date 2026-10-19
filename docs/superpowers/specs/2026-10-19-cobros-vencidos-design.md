# Cobros vencidos: reintento automático

Fecha: 2026-10-19 · Alcance: `backend/` · Aprobado por el usuario el 2026-10-19.

## Problema

`tocaCobrarHoy` (en `scheduler.js`) solo responde "¿hoy es día de cobro?". El historial guarda cuándo salió cada correo, pero no a qué día de cobro correspondía. Si el día de cobro pasa sin envío (servidor caído, SMTP fallido), el cobro no se vuelve a intentar nunca.

## Decisiones

- **"Vencido"** es un cobro cuyo día ya pasó y no tiene ningún envío `Enviado` en esa fecha o después. No depende de que el cliente haya pagado: el sistema no registra pagos.
- **Reintento:** el cron diario envía los vencidos durante 7 días (configurable con `COBROS_REINTENTO_DIAS`; `0` lo desactiva y solo cobra lo de hoy). Pasada la ventana, el cobro está **perdido**: no se envía y se informa.
- **Sin cambios de esquema.** Todo se deduce del historial. Un `Fallido` no cuenta como enviado, así que se reintenta al día siguiente.
- **Zona horaria:** las fechas se calculan en `America/Bogota` (configurable con `APP_TZ`), no en la del servidor ni en UTC.
- **Multi-tenant:** los clientes se resuelven dentro de los del usuario autenticado, nunca por id global.

## Diseño

1. `backend/cobros.js` (puro, sin base de datos): `tocaCobrarEn`, `ultimoCobroSinEnviar`, `planificarCobros`, `ventanaReintento`, `hoyISO`, `aISO`, `sumarDias`. Tiene pruebas con `node --test`.
2. `scheduler.js` usa `planificarCobros`: `procesarCobrosDelDia` envía lo de hoy y los vencidos y devuelve `{ enviados, vencidosEnviados, omitidos, perdidos }`. Expone `previsualizarCobros(usuarioId, confirmarReenvio)` y `resumenCobros(usuarioId)`. Los envíos de cobros vencidos quedan en el historial como "vencido desde AAAA-MM-DD".
3. `api.js`:
   - `GET /cobros/resumen` devuelve `{ hoy, ventanaDias, paraHoy, vencidos, perdidos }`, filtrado por el `usuario.id` del JWT.
   - `POST /run` incluye los vencidos. Responde 409 con `requiereConfirmacion` solo cuando no hay nada que enviar y sí hay cobros de hoy ya enviados, así el reenvío manual sigue funcionando y los vencidos no quedan bloqueados.

## Riesgos y despliegue

- **Primer arranque en producción:** puede reenviar correos de cobros de los últimos 7 días que se gestionaron fuera del sistema. Desplegar con `COBROS_REINTENTO_DIAS=0` y mantenerlo al menos 7 días: con 0 solo se cobra lo de hoy (como antes) y los cobros previos al despliegue salen de la ventana solos. Si se activa antes, revisar en `GET /cobros/resumen` de cada usuario la lista `perdidos` con `diasVencido <= 7`: esos saldrán al activar.
- **Suscripción creada después del cron del día de su `fecha_alta`:** al día siguiente figura como vencida 1 día y recibe el cobro. Es el comportamiento buscado.
- **Un `Fallido` repetido** deja una fila por intento (hasta 7). Es un registro, no un problema.

## Fuera de alcance

- Mostrar los vencidos en el Dashboard (Fase 6 del rediseño; el endpoint ya queda listo).
- Registrar pagos y mora (posible etapa posterior).
- El teléfono de WhatsApp de Café Valdore está fijo en `mailer.js:39`: los correos de cualquier empresa lo muestran. Se reporta, no se corrige aquí.
