# Aviso de clientes sin cobro (rebote de correo)

*Fecha: 2026-10-28*

## Problema

`mailer.esReboteDireccion()` detecta direcciones inexistentes (5.1.x) y el scheduler guarda `clientes.correo_rebotado`. Mientras esa columna coincida con `correo`, el cliente se omite en silencio: ni el cron ni el reenvío manual le envían nada. La UI no lo muestra, así que el dueño cree que el recordatorio salió, y el cliente nunca se entera del cobro.

## Objetivo

Que al entrar al panel se vea, sin revisar la tabla, qué clientes con suscripciones activas no están recibiendo cobros, cuánto representan, y que se pueda ir a corregir el correo desde ahí.

## No objetivos

- No cambia el scheduler ni la detección de rebotes.
- No hay webhook de rebotes, ni fecha del rebote, ni envío forzado a una dirección marcada.
- No se añade teléfono ni canal de contacto por cliente: la comunicación externa ocurre fuera de la app.

## Anti-objetivos

- Marcar como roto a un cliente cuyo correo ya se corrigió. La columna conserva el valor viejo y el bloqueo se levanta por comparación, así que la UI debe comparar `correo_rebotado === correo`, nunca comprobar si la columna tiene valor.
- Dejar una sección vacía permanente cuando no hay rebotes: si el conjunto está vacío, la sección no se renderiza.

## Decisiones del usuario

1. Solo entran clientes con **al menos una suscripción activa**.
2. Opción **B**: aviso en el Dashboard y marca en la fila de Clientes.

## Conjunto afectado

Clientes donde `correo_rebotado` existe, es igual a `correo`, y el cliente tiene al menos una suscripción activa. Se calcula en el frontend con los datos que ambas vistas ya cargan (`getClientes` + `getSuscripciones`); no hay endpoint nuevo ni cambio de esquema.

Vive en un helper puro `src/lib/rebotes.js`, siguiendo el patrón de `lib/` (función pura + `node:test`), para poder probarlo sin DOM.

## Dashboard

Sección nueva entre "Hoy" y "Tu negocio", solo cuando el conjunto no está vacío.

- Título `h2`: "Clientes que no reciben cobros".
- Descripción: cuántos son y el total de sus suscripciones activas; explica que el correo rebotó y que los recordatorios se reanudan al corregir la dirección.
- Botón "Corregir correos" en la cabecera de la sección: navega a la vista Clientes.
- Lista con el patrón `.libro` de "Próximos cobros" (misma estructura de tres columnas): nombre, correo rebotado + número de suscripciones, monto. En móvil hereda el reflow que ya existe.

Requiere pasar `onNavegar={setView}` a `<Dashboard />` en `App.jsx`, como ya se hace con `Configuracion`.

## Clientes

En la celda Correo, cuando el rebote está activo:

- `Badge` tono `warn`, icono `warning-circle`, texto "Correo rebotado".
- Nota debajo: que no recibe cobros hasta que se corrija el correo.

Cierra el ciclo: el aviso del Dashboard lleva a la vista, y la marca dice cuál fila y qué hacer.

## Estilos (impeccable, modo Operate)

Sin decoración nueva ni color nuevo. Tokens existentes: `--warn`, `--warn-bg`, `--ink-2`, `--line`. Clases existentes: `panel`, `panel-titulo`, `pagina-desc`, `libro*`, `badge`, `celda-nota`. El color de marca sigue entrando solo por `aplicarColorTema()`.

Se añade como máximo una regla de layout para la cabecera de la sección (título + descripción + botón en una fila que colapsa en móvil). El estado no depende solo del color: el badge lleva icono y texto.

## Verificación

- `npm test` en el frontend: pruebas del helper puro (incluye el caso de correo ya corregido y el de cliente sin suscripciones activas).
- `npm run build`.
- `npm run test:unit` en el backend: pruebas de `mensajeProceso`.
- Revisión visual en escritorio y a 360 px, con y sin rebotes.

## Corrección incluida: mensaje de `POST /run`

`scheduler.js` usa un solo contador `omitidos` para dos causas distintas: los cobros que ya se enviaron hoy (`:122`) y los clientes omitidos por rebote (`:133`). Con eso, `api.js:281` responde "N ya enviados hoy se omitieron" incluso cuando esos N no se enviaron nunca por tener el correo rebotado. Contradice el aviso nuevo.

Se separan los contadores (`omitidos` se queda con "ya enviados hoy" y aparece `omitidosRebote`) y el texto se construye en una función pura `mensajeProceso(resultado)` en `cobros.js`, para poder probarla sin base de datos. El campo `omitidos` de la respuesta conserva su significado actual; se añade `omitidosRebote`.
