# AGENTS.md

SGCRC: recordatorios de cobro recurrentes. Backend Node.js con `http` nativo + SQLite; frontend React 18 + Vite. UI, mensajes de error, comentarios y commits van en **español** (`feat(frontend): ...`, `fix: ...`).

Referencia por subproyecto: `backend/CLAUDE.md` y `sgcrc-frontend-export/CLAUDE.md`. Despliegue en la VPS: `docs/despliegue-docker.md`. Ante conflicto con el código, manda el código.

## Estructura

Dos proyectos npm independientes, sin workspace ni tooling compartido. Instalar dependencias en cada uno:

- `backend/` — API, scheduler, mailer, SQLite (`data/sgcrc.db`).
- `sgcrc-frontend-export/` — SPA; el nombre de carpeta no coincide con el nombre del paquete (`sgcrc-frontend`).

## Comandos

```bash
# Backend (:3000)
cd backend && npm run dev          # node --watch
npm test                           # smoke de la API (levanta su propio servidor en puerto 0)
npm run test:unit                  # cobros + perfil + mailer + config, sin base de datos
npm run test:security              # aislamiento multi-tenant, validación, perfil
npm run test:integration           # scheduler con correo simulado

# Frontend (:5173, proxy /api → :3000 quitando el prefijo /api)
cd sgcrc-frontend-export && npm run dev
npm test                           # node --test src/lib/*.test.js
npm run build && npm run preview   # verificar antes de desplegar
npm run icons                      # regenera src/ui/icons.generated.js
```

No hay linter, formatter, typecheck ni CI. La verificación es `npm test` en cada proyecto (y `npm run build` en el frontend).

## Arquitectura que no se deduce de los nombres

- **Router imperativo**: `backend/api.js` despacha con `if (pathname.startsWith(...))` tras la verificación JWT (línea ~100). No hay Express. Para un endpoint nuevo: métodos en `db.js` y bloque nuevo en `api.js` después del JWT, usando `obtenerUsuario(req)`.
- **Multi-tenant obligatorio**: toda consulta filtra por `usuario_id`. Un id de otro usuario responde 404, nunca 403. Los nombres de columna de un UPDATE salen de la lista blanca `COLUMNAS` en `db.js`, jamás del body.
- **Migraciones**: no hay Knex/Prisma. Añadir el campo al `CREATE TABLE` de `database.js` y un `try { db.prepare("ALTER TABLE ...").run(); } catch(e) {}` al final del archivo. Si el campo es editable, agregarlo también a `COLUMNAS` y a los validadores de `create`/`update`.
- **Lógica de cobros**: las reglas de fechas viven en `backend/cobros.js` (puro y testeado); `scheduler.js` solo orquesta. `src/lib/calendario.js` replica `tocaCobrarEn` y una prueba de paridad en `src/lib/calendario.test.js` las compara: si cambias una, cambia la otra.
- **Rebotes permanentes**: `mailer.esReboteDireccion()` detecta el 5.1.x (dirección inexistente) y el scheduler guarda `clientes.correo_rebotado`. Mientras esa columna coincida con `correo`, el cliente se omite sin aviso en la UI: la marca solo se limpia cuando el correo cambia.
- **Frontend sin router**: `App.jsx` enruta por estado con el objeto `VIEWS`; la navegación vive en `src/lib/navegacion.js` (`NAV`, `IDS_BARRA_MOVIL`). Una vista nueva debe registrarse en ambos.
- **Estilos**: sin Tailwind (no hay config ni PostCSS; reset propio en `src/styles/base.css`). Usar clases de `ui.css`/`shell.css` y variables CSS. El color de marca solo se aplica con `aplicarColorTema()`; nunca `setProperty('--color-primario', ...)` ni colores hardcodeados.
- **HTTP del frontend**: solo `src/api.js` (usa `fetch`). `axios` está en `package.json` pero no se usa; no mezclar.
- **Fechas**: el "día" es `America/Bogota`. Usar `diaEnZona`/`esDelDia` de `src/lib/formato.js`; no comparar contra UTC.
- **Carga de vistas**: patrón único `useCarga` + `Skeleton` + `ErrorMsg`; errores de usuario con `mensajeError(e)`, nunca `err.message`. Diálogos y confirmaciones con `Dialog`/`ConfirmDialog` y toasts, no `alert`/`confirm`.

## Gotchas

- **No ejecutar `POST /run` ni pulsar "Enviar" en el Dashboard** salvo que se quieran mandar correos reales. Para probar UI, abrir y cerrar el diálogo.
- **Nunca correr tests del backend contra producción**: todos excepto `test:unit` escriben usuarios temporales en la base real (`backend/data/sgcrc.db` en local, `/app/data/sgcrc.db` en el contenedor). `database.js` ignora `DB_PATH`: la ruta es fija.
- `JWT_SECRET` es obligatorio: sin él el proceso sale con código 1. Avisa si mide menos de 32 caracteres.
- `CORS_ORIGIN` del `.env.example` no está implementado; `api.js` responde `Access-Control-Allow-Origin: *`.
- `src/ui/icons.generated.js` es generado: para añadir un icono, editar `ICONOS` en `scripts/gen-icons.mjs` y correr `npm run icons`.
- `backend/auth/login/` y `backend/auth/register/` están vacías (restos de un refactor).
- **Despliegue**: `docker compose up -d --build` en la VPS y `docker compose ps` hasta ver `sgcrc-api` y `sgcrc-web` en `healthy`. El stack no publica puertos: lo expone el Caddy que ya corre allí. Detalle en `docs/despliegue-docker.md`.
- **Una sola réplica de `api`**: el mutex del scheduler es en memoria, así que dos contenedores duplicarían correos. No usar `docker compose up --scale`.
- **`docker compose down -v` borra el volumen `sgcrc_data`** y con él la base. Para bajar el stack, `docker compose down` sin `-v`.
