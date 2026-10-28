# Despliegue Docker de SGCRC — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empaquetar backend y frontend en dos imágenes Docker y orquestarlas con un compose que no publique puertos, servido detrás del Caddy existente de la VPS.

**Architecture:** `sgcrc-api` (Node 22, sin puerto en el host, SQLite en volumen nombrado) y `sgcrc-web` (build de Vite servido por nginx, que reenvía `/api/` al backend). Ambos comparten la red interna del proyecto; solo `web` se une a la red externa `sgcrc` que usa Caddy.

**Tech Stack:** Docker 29, Docker Compose v5, Node 22 (Debian slim), nginx 1.27 alpine, SQLite (`better-sqlite3`), Vite 7.

**Spec:** `docs/superpowers/specs/2026-10-28-docker-deployment-design.md`

## Global Constraints

- **Cero puertos publicados** en el host: ni `3000` ni `80`.
- Nombres fijos: contenedores `sgcrc-api` y `sgcrc-web`; red externa `sgcrc`; volumen `sgcrc_data`.
- `backend/.env` nunca entra en la imagen; se inyecta con `env_file`.
- Una sola réplica de `api` (el mutex del scheduler es en memoria).
- `TZ=America/Bogota` en el backend; el scheduler ya usa `APP_TZ`.
- Base del backend y del build: `node:22-bookworm-slim`. Frontend servido por `nginx:1.27-alpine`.
- Documentación, comentarios y commits en español (`feat(docker): ...`).
- **No** ejecutar `POST /run` ni pulsar "Enviar" durante la verificación.
- La red `sgcrc` se crea a mano (`docker network create sgcrc`) y se declara `external: true`; ningún compose la posee.

## Review Focus

- **Arranque sin `JWT_SECRET`:** el contenedor debe salir con código 1 y un mensaje claro, no reiniciar en bucle sin explicación.
- **Persistencia:** un `docker compose down` + `up` conserva la base en `sgcrc_data` (incluidos `-wal`/`-shm`).
- **Ruta profunda del SPA:** `/dashboard` devuelve `index.html` con 200, no 404.
- **Quitar el prefijo `/api`:** `/api/health` llega como `/health` (sin doble barra) y responde `{"status":"ok"}`.
- **Recrear solo `api`:** nginx no debe quedarse con la IP vieja del backend (502 hasta reiniciar).
- **Usuario no root:** el proceso corre como `node` (uid 1000) y puede escribir en `/app/data`.

---

### Task 1: Imagen del backend

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

**Interfaces:**
- Consumes: nada.
- Produces: imagen `sgcrc-api:latest` que escucha en `3000`, escribe en `/app/data` y expone `/health`. La usan las tareas 3 y 5.

- [ ] **Step 1: Crear `backend/.dockerignore`**

```
node_modules
data
.env
.env.*
*.test.js
tests_*.js
check_db.js
migrar.js
.git
```

- [ ] **Step 2: Crear `backend/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# Etapa 1: dependencias de producción (compila better-sqlite3 si no hay prebuild)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Etapa 2: runtime mínimo
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=America/Bogota
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node index.js api.js auth.js cobros.js config.js database.js db.js mailer.js perfil.js scheduler.js ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
```

- [ ] **Step 3: Construir la imagen**

Run: `docker build -t sgcrc-api:test ./backend`
Expected: build termina sin error; `docker image inspect sgcrc-api:test` existe.

- [ ] **Step 4: Verificar que falla sin `JWT_SECRET`**

Run: `docker run --rm sgcrc-api:test`
Expected: exit code 1 y en el log `Error fatal al iniciar: JWT_SECRET no está definido...` (no queda reiniciando).

- [ ] **Step 5: Verificar arranque, health y permisos del volumen**

```bash
docker volume create sgcrc_api_test
docker run -d --name sgcrc-api-test \
  -e JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))") \
  -e SMTP_HOST=127.0.0.1 -e SMTP_PORT=1 \
  -v sgcrc_api_test:/app/data \
  -p 127.0.0.1:18080:3000 sgcrc-api:test
sleep 15
curl -s http://127.0.0.1:18080/health
docker exec sgcrc-api-test id -u
docker exec sgcrc-api-test ls -la /app/data
```

Expected: `{"status":"ok"}`; `id -u` → `1000`; `/app/data` contiene `sgcrc.db` (y `-wal`/`-shm`) con dueño `node`.
(`SMTP_HOST=127.0.0.1` solo hace que la verificación SMTP falle rápido en la prueba.)

- [ ] **Step 6: Limpiar y commitear**

```bash
docker rm -f sgcrc-api-test && docker volume rm sgcrc_api_test
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat(docker): imagen del backend con SQLite persistente y healthcheck"
```

---

### Task 2: Imagen del frontend y nginx

**Files:**
- Create: `sgcrc-frontend-export/Dockerfile`
- Create: `sgcrc-frontend-export/nginx.conf`
- Create: `sgcrc-frontend-export/.dockerignore`

**Interfaces:**
- Consumes: nada (el upstream `api:3000` se resuelve en runtime).
- Produces: imagen `sgcrc-web:latest` que sirve el SPA en el puerto 80 y reenvía `/api/*` a `http://api:3000/*`. La usan las tareas 3 y 5.

- [ ] **Step 1: Crear `sgcrc-frontend-export/.dockerignore`**

```
node_modules
dist
.git
*.test.js
```

- [ ] **Step 2: Crear `sgcrc-frontend-export/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Docker DNS: re-resuelve "api" para no quedarse con la IP vieja al recrear el backend.
    resolver 127.0.0.11 valid=10s ipv6=off;

    location /api/ {
        set $api_upstream http://api:3000;
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass $api_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: Crear `sgcrc-frontend-export/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
```

- [ ] **Step 4: Construir y validar la config de nginx**

Run: `docker build -t sgcrc-web:test ./sgcrc-frontend-export && docker run --rm sgcrc-web:test nginx -t`
Expected: `syntax is ok` y `test is successful`.

- [ ] **Step 5: Verificar SPA y ruta profunda**

```bash
docker run -d --name sgcrc-web-test -p 127.0.0.1:18081:80 sgcrc-web:test
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18081/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18081/dashboard
curl -s http://127.0.0.1:18081/dashboard | grep -c '<div id="root">'
```

Expected: `200`, `200`, `1`.

- [ ] **Step 6: Limpiar y commitear**

```bash
docker rm -f sgcrc-web-test
git add sgcrc-frontend-export/Dockerfile sgcrc-frontend-export/nginx.conf sgcrc-frontend-export/.dockerignore
git commit -m "feat(docker): imagen del frontend con nginx y proxy /api"
```

---

### Task 3: Compose, red externa y entorno

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/.env.docker.example`
- Modify: `backend/.env` (solo si falta `JWT_SECRET`; archivo no versionado)

**Interfaces:**
- Consumes: `sgcrc-api:latest` (Task 1) y `sgcrc-web:latest` (Task 2).
- Produces: stack `sgcrc` con contenedores `sgcrc-api` y `sgcrc-web`; `sgcrc-web` accesible por nombre en la red `sgcrc`.

- [ ] **Step 1: Crear `docker-compose.yml`**

```yaml
name: sgcrc

services:
  api:
    build:
      context: ./backend
    image: sgcrc-api:latest
    container_name: sgcrc-api
    restart: unless-stopped
    env_file:
      - ./backend/.env
    environment:
      NODE_ENV: production
      PORT: "3000"
      TZ: America/Bogota
    volumes:
      - sgcrc_data:/app/data
    networks:
      - interna
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  web:
    build:
      context: ./sgcrc-frontend-export
    image: sgcrc-web:latest
    container_name: sgcrc-web
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    networks:
      - interna
      - sgcrc
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  sgcrc_data:
    name: sgcrc_data

networks:
  interna:
  sgcrc:
    external: true
    name: sgcrc
```

- [ ] **Step 2: Crear `backend/.env.docker.example`**

```
# Copiar a backend/.env (ignorado por git) y completar antes de `docker compose up`.

# Obligatorio: sin esto el contenedor sale con código 1.
# Generar con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_contraseña_de_aplicacion
SMTP_FROM="SGCRC Cobros <tu_correo@gmail.com>"
SMTP_REQUIRED=false

PORT=3000
CRON_HORA=08
CRON_MIN=00
APP_TZ=America/Bogota

# Primer despliegue: 0 durante al menos 7 días (evita reenviar cobros previos).
COBROS_REINTENTO_DIAS=0
```

- [ ] **Step 3: Asegurar `JWT_SECRET` en `backend/.env`**

Si falta, añadirlo sin romper el archivo (funciona igual en Windows y Linux):

```bash
node -e "const fs=require('fs'),p='backend/.env';let s=fs.readFileSync(p,'utf8');if(!/^JWT_SECRET=.+/m.test(s)){if(!s.endsWith('\n'))s+='\n';s+='JWT_SECRET='+require('crypto').randomBytes(48).toString('hex')+'\n';fs.writeFileSync(p,s);console.log('JWT_SECRET añadido')}else console.log('JWT_SECRET ya existe')"
```

Expected: `JWT_SECRET añadido` o `JWT_SECRET ya existe`, y `grep -c '^JWT_SECRET=..' backend/.env` → `1`. (Cambiar el secreto invalida las sesiones locales existentes.)

- [ ] **Step 4: Crear la red externa y validar el compose**

```bash
docker network create sgcrc 2>/dev/null || true
docker compose config --quiet
```

Expected: sin salida en el segundo comando (config válida).

- [ ] **Step 5: Levantar el stack**

Run: `docker compose up -d --build`
Expected: ambos contenedores `running`; `docker compose ps` muestra `sgcrc-api` y `sgcrc-web` como `healthy`.
Si `api` tarda en pasar a `healthy`, es `verificarConexion()` esperando al SMTP (hasta 120 s por los timeouts de nodemailer): revisar `docker compose logs api`.

- [ ] **Step 6: Verificar proxy y ruta profunda dentro de la red**

```bash
docker exec sgcrc-web wget -qO- http://127.0.0.1/api/health
docker exec sgcrc-web wget -qO- http://127.0.0.1/dashboard | grep -c '<div id="root">'
docker exec sgcrc-api id -u
docker compose logs api | grep -c 'Scheduler'
```

Expected: `{"status":"ok"}`; `1`; `1000`; `1`.

- [ ] **Step 7: Verificar persistencia y re-resolución del upstream**

```bash
docker exec sgcrc-api ls /app/data
docker compose down
docker compose up -d
docker exec sgcrc-api ls /app/data
docker compose up -d --force-recreate api
sleep 15
docker exec sgcrc-web wget -qO- http://127.0.0.1/api/health
```

Expected: `sgcrc.db` existe antes y después del `down`; tras recrear solo `api`, `/api/health` responde `{"status":"ok"}` (sin 502).

- [ ] **Step 8: Commitear**

```bash
git add docker-compose.yml backend/.env.docker.example
git commit -m "feat(docker): compose con red externa, volumen persistente y sin puertos publicados"
```

---

### Task 4: Guía de despliegue

**Files:**
- Create: `docs/despliegue-docker.md`

**Interfaces:**
- Consumes: nombres y comandos de las tareas 1-3.
- Produces: procedimiento operativo para la VPS.

- [ ] **Step 1: Escribir `docs/despliegue-docker.md`**

Debe cubrir, con comandos copiables:

1. **Requisitos:** Docker + Compose, red `sgcrc`, DNS de `sgcr.myconnectfibraoptica.com` apuntando a la VPS.
2. **Primer despliegue:** clonar, `cp backend/.env.docker.example backend/.env`, completar `JWT_SECRET` y SMTP, `docker network create sgcrc`, `docker compose up -d --build`, `docker compose ps`.
3. **Conectar Caddy (sin downtime):** `docker network connect sgcrc myconnect-caddy-1` y `docker exec myconnect-caddy-1 caddy reload --config /etc/caddy/Caddyfile`. Verificar con `docker exec myconnect-caddy-1 getent hosts sgcrc-web`.
4. **Persistir la red en myconnect:** añadir `sgcrc` como red externa al compose de myconnect para futuras recreaciones.
5. **Migrar la base existente:** parar el stack, copiar `sgcrc.db` (y `-wal`/`-shm`) al volumen con un contenedor auxiliar, arrancar.
6. **Actualizar:** `git pull && docker compose up -d --build`.
7. **Backup/restauración:** `docker run --rm -v sgcrc_data:/data -v "$PWD":/backup alpine tar czf /backup/sgcrc-$(date +%F).tar.gz -C /data .` y el inverso.
8. **Diagnóstico:** `docker compose logs -f api`; consultar la DB sin entrar al contenedor:
   ```bash
   docker exec sgcrc-api node -e "const d=require('better-sqlite3')('/app/data/sgcrc.db');console.log(d.prepare('select count(*) as usuarios from usuarios').get())"
   ```
   healthchecks (`docker inspect --format '{{.State.Health.Status}}' sgcrc-api`), y 502 → comprobar que Caddy está en la red (`docker exec myconnect-caddy-1 getent hosts sgcrc-web`).
9. **Advertencias:** una sola réplica, no ejecutar `POST /run` en pruebas, `COBROS_REINTENTO_DIAS=0` los primeros 7 días.

- [ ] **Step 2: Verificar que los comandos existen en el repo**

Run: `grep -n "docker network create sgcrc" docs/despliegue-docker.md`
Expected: al menos una coincidencia.

- [ ] **Step 3: Commitear**

```bash
git add docs/despliegue-docker.md
git commit -m "docs(docker): guía de despliegue, actualización y backup en la VPS"
```

---

### Task 5: Verificación final en la VPS

**Files:**
- Modify: ninguno (solo ejecución y comprobaciones).

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: stack funcionando en `https://sgcr.myconnectfibraoptica.com`.

- [ ] **Step 1: Desplegar en la VPS**

Run: `docker compose up -d --build && docker compose ps`
Expected: `sgcrc-api` y `sgcrc-web` en `healthy`.

- [ ] **Step 2: Verificar HTTPS y SPA**

Run: `curl -sI https://sgcr.myconnectfibraoptica.com | head -n 1`
Expected: `HTTP/2 200` (o `HTTP/1.1 200`).

- [ ] **Step 3: Verificar API a través de Caddy**

Run: `curl -s https://sgcr.myconnectfibraoptica.com/api/health`
Expected: `{"status":"ok"}`.

- [ ] **Step 4: Verificar login real (sin enviar correos)**

Abrir la web, iniciar sesión y navegar a Clientes/Planes. **No** pulsar "Enviar" en el Dashboard.
Expected: login correcto y datos visibles.

- [ ] **Step 5: Comprobar que no hay puertos nuevos en el host**

Run: `docker ps --format '{{.Names}}\t{{.Ports}}' | grep sgcrc`
Expected: `sgcrc-api` y `sgcrc-web` sin mapeo de puertos (`3000/tcp` / `80/tcp` internos, sin `0.0.0.0:`).
