# Revisión de mejoras sugeridas — CobrosApp (SGCRC)

## Hallazgos principales

1. **Falta de autenticación/autorización en el backend**
   - Todas las rutas administrativas (`/clientes`, `/suscripciones`, `/historial`, `/run`) están expuestas sin protección.

2. **Validaciones de entrada básicas e incompletas**
   - Actualmente solo se valida presencia de campos en algunos endpoints; no se valida formato de correo, rango de `dia_cobro`, montos positivos ni tipos.

3. **Persistencia JSON con operaciones síncronas**
   - La base de datos local usa `fs.readFileSync/writeFileSync`, lo que bloquea el event loop y puede degradar rendimiento.

4. **Riesgo de ejecución concurrente de cobros**
   - `/run` lanza el proceso sin bloqueo; si se invoca varias veces o coincide con el cron, puede duplicar envíos.

5. **Conectividad SMTP no bloqueante al iniciar**
   - Aunque se verifica SMTP al arranque, la app continúa incluso si falla, lo que puede generar errores operativos continuos.

6. **Posible inyección HTML en correos**
   - Se interpolan campos de usuario directamente en HTML (`cliente.nombre`, `suscripcion.tipo`, `descripcion`) sin escape.

7. **Cálculo de próximos cobros simplificado en frontend**
   - En dashboard se usa `31` fijo para rollover mensual, lo cual puede dar proyecciones incorrectas en meses de 28/29/30 días.

8. **Sin suite de pruebas automatizadas**
   - No hay tests en backend/frontend, dificultando refactors seguros.

9. **Observabilidad limitada**
   - Falta logging estructurado, métricas y trazabilidad de fallos por endpoint/tarea.

10. **Configuración CORS abierta**
   - Se usa `Access-Control-Allow-Origin: *` globalmente sin lista permitida por entorno.

## Prioridad recomendada (corto plazo)

1. Seguridad base: autenticación + validación robusta de entradas.
2. Evitar duplicados de cobro: lock/idempotencia en scheduler y endpoint `/run`.
3. Escape de HTML en plantillas de correo.
4. Corrección de cálculo de fecha en Dashboard.
5. Pruebas mínimas: smoke tests API y casos críticos de scheduler.

## Próximo paso sugerido

- Crear un roadmap de 2 semanas con entregables por bloque: **Seguridad**, **Confiabilidad de cobros**, **Calidad (tests + logs)**.
