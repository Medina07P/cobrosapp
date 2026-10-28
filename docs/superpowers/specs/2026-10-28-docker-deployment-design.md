# Despliegue con Docker en VPS con Caddy

Fecha: 2026-10-28 · Alcance: raíz del repo, `backend/`, `sgcrc-frontend-export/` · Pendiente de aprobación.

## Problema

El despliegue actual es manual (`pm2 restart sgcrc-backend` + copiar `dist/*` a `/var/www/cobrosapp/frontend/`). La VPS ya corre otros servicios y un Caddy en contenedor que ocupa 80/443. Se quiere que SGCRC corra en Docker sin publicar puertos que puedan chocar.

## Estado de la VPS (dato del usuario)

- `myconnect-caddy-1` (`caddy:2-alpine`) publica `80` y `443`; es el punto de entrada.
- Otros servicios (`myconnect-web`, `jellyfin`) no publican puertos al host o lo hacen en `127.0.0.1`.
- Red compartida disponible: `sgcrc`.
- Dominio: `sgcr.myconnectfibraoptica.com`.

## Objetivos

- Levantar SGCRC con `docker compose up -d --build`, sin tocar la config de los otros servicios.
- **Cero puertos publicados en el host**: el único acceso es a través de Caddy.
- Persistir la base SQLite entre reinicios y reconstrucciones.
- Mantener el scheduler dentro del backend, en `America/Bogota`, sin duplicar envíos.

## No objetivos

- TLS propio en la app (lo termina Caddy).
- Compose de desarrollo con hot-reload.
- Cambiar SQLite por otro motor.
- CI/CD, backups automáticos, observabilidad más allá del healthcheck.

## Anti-objetivos (harían fallar el despliegue)

- Publicar `3000` o `80` en el host: reintroduce el problema de puertos.
- Hornear `backend/.env` en la imagen: filtra credenciales SMTP y `JWT_SECRET`.
- Escalar `api` a más de una réplica: el mutex del scheduler es en memoria y se duplicarían correos.
- Guardar la DB fuera de `/app/data`: `database.js` ignora `DB_PATH` y siempre usa `__dirname/data/sgcrc.db`.

## Enfoques considerados

- **A. Red Docker compartida con Caddy (elegido).** `sgcrc-web` se une a la red externa `sgcrc`; Caddy hace `reverse_proxy sgcrc-web:80`. Sin puertos en el host.
- **B. Publicar en `127.0.0.1:<puerto>`.** Caddy tendría que usar `host.docker.internal` (y `extra_hosts: host-gateway`), porque `127.0.0.1` dentro de Caddy no es el host. Más frágil y obliga a tocar myconnect.
- **C. Publicar en `0.0.0.0:<puerto>`.** Deja el puerto expuesto sin TLS propio. Descartado.

Se eligió A: no hay puerto que choque y el ruteo por nombre de contenedor es estable.

## Diseño

1. **`backend/Dockerfile`** (multi-stage, `node:22-bookworm-slim`):
   - Etapa `deps`: `npm ci --omit=dev` con `python3 make g++` para compilar `better-sqlite3` si no hay binario precompilado.
   - Etapa final: copia `node_modules` y el código, usuario `node`, `WORKDIR /app`, `TZ=America/Bogota`, `PORT=3000`.
   - Crea `/app/data` con dueño `node` para que el volumen nombrado herede el permiso.
   - `HEALTHCHECK` contra `http://127.0.0.1:3000/health` usando `fetch` de Node (sin instalar curl).
   - Sin `devDependencies`, sin tests, sin `.env`, sin `data/` en la imagen.
2. **`sgcrc-frontend-export/Dockerfile`** (multi-stage):
   - Etapa `build`: `node:22-bookworm-slim`, `npm ci`, `npm run build`.
   - Etapa final: `nginx:1.27-alpine` con `dist/` y una config propia.
3. **`sgcrc-frontend-export/nginx.conf`**:
   - `location /api/ { proxy_pass http://api:3000/; }` (quita el prefijo `/api`, igual que el proxy de Vite).
   - `proxy_read_timeout 300s` para `/run`, que envía correos.
   - SPA: `try_files $uri $uri/ /index.html`.
   - `/assets/` con cache inmutable; `index.html` sin cache.
4. **`docker-compose.yml`** en la raíz, proyecto `sgcrc`:
   - `api`: sin `ports`, volumen `sgcrc_data:/app/data`, `env_file: ./backend/.env`, `restart: unless-stopped`, healthcheck.
   - `web`: sin `ports`, `depends_on: api (service_healthy)`, healthcheck con `wget`.
   - `api` solo en la red interna `interna`; `web` en `interna` y en la red externa `sgcrc`. Caddy solo alcanza `web`.
   - `logging` con rotación (`max-size: 10m`, `max-file: 3`).
   - Nombres fijos `sgcrc-api` y `sgcrc-web` para que el upstream de Caddy no cambie.
5. **Red `sgcrc`**: se crea **una sola vez a mano** (`docker network create sgcrc`) y ambos stacks la declaran `external: true`. Ningún `docker compose down` se la lleva. Si la creara el stack de SGCRC, un `down` de SGCRC rompería myconnect.
6. **Caddy** (config real en la VPS, gestionada por el agente de allá):
   ```
   sgcr.myconnectfibraoptica.com {
       encode zstd gzip
       reverse_proxy sgcrc-web:80
   }
   ```
   Aplicación sin downtime: `docker network connect sgcrc myconnect-caddy-1` + `docker exec myconnect-caddy-1 caddy reload --config /etc/caddy/Caddyfile`. La recreación del contenedor de Caddy solo hace falta para persistir la red en el compose de myconnect; no es urgente.
7. **Secretos**: `backend/.env` sigue fuera de git y se inyecta con `env_file`. Se añade `.env.docker.example` documentando lo obligatorio. **Hoy `backend/.env` no tiene `JWT_SECRET`**: sin él el contenedor sale con código 1. Hay que generarlo antes del primer arranque.
8. **Datos**: volumen nombrado `sgcrc_data`. Si se migra la DB actual, se copia `sgcrc.db` (y sus `-wal`/`-shm`) al volumen antes de arrancar; si no, se crea vacía.
9. **Documentación**: `docs/despliegue-docker.md` con primer despliegue, actualización, backup/restauración y diagnóstico.
10. **`.dockerignore`** en ambos subproyectos (`node_modules`, `data`, `dist`, `.env`, tests).

## Orden de despliegue

1. Crear la red `sgcrc` (idempotente).
2. Construir y levantar el stack de SGCRC; verificar `/health` y el SPA dentro de la red.
3. Conectar `myconnect-caddy-1` a `sgcrc` y recargar Caddy (sin recrear).
4. Verificar HTTPS y login real en `https://sgcr.myconnectfibraoptica.com`.
5. Persistir la red en el compose de myconnect para futuras recreaciones.

## Riesgos y verificaciones

- `better-sqlite3` es nativo: si el prebuild de Node 22 no aplica, la etapa `deps` lo compila. Verificar con `docker compose build` y arrancar.
- Permisos del volumen: si el volumen se crea vacío sobre `/app/data` con dueño `node`, funciona; un bind mount requeriría `chown`.
- Scheduler duplicado: una sola réplica de `api`. El compose no debe escalarse.
- Primer arranque: `COBROS_REINTENTO_DIAS=0` al menos 7 días (misma advertencia que el despliegue actual) para no reenviar cobros previos.
- CORS abierto (`*`) deja de importar en el navegador porque todo pasa por el mismo origen; no se toca.
- Verificación: `docker compose config`, `docker compose up -d --build`, `curl` a `/health` desde dentro de la red, carga del SPA, y `GET /cobros/resumen` con un token real. **No** ejecutar `POST /run`.

## Decisiones tomadas por el agente

- Dos contenedores en lugar de uno: nginx ya resuelve SPA + proxy sin tocar código.
- `nginx:1.27-alpine` como base del frontend; `node:22-bookworm-slim` para backend y build (evita sorpresas de musl con módulos nativos).
- Volumen nombrado en vez de bind mount: hereda permisos y no depende de rutas de la VPS.
- Sin compose de desarrollo: el flujo local con `npm run dev` sigue igual.

## Fuera de alcance

- Migrar la DB existente automáticamente (se documenta el comando).
- Backups programados.
- Endurecer CORS, límite de tamaño de body y política de contraseñas (problemas ya conocidos del backend).
