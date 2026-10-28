# Despliegue de SGCRC con Docker

SGCRC corre en dos contenedores detrás del Caddy que ya existe en la VPS. **No publica ningún puerto en el host**: el único acceso es `https://sgcr.myconnectfibraoptica.com`.

| Contenedor | Imagen | Red | Puerto interno |
|---|---|---|---|
| `sgcrc-api` | `sgcrc-api:latest` | `sgcrc_interna` | 3000 |
| `sgcrc-web` | `sgcrc-web:latest` | `sgcrc_interna` + `sgcrc` (externa) | 80 |

- `sgcrc-web` sirve el SPA y reenvía `/api/*` a `http://api:3000/*` (quita el prefijo).
- La base SQLite vive en el volumen `sgcrc_data`, montado en `/app/data`.
- El scheduler corre dentro de `sgcrc-api`, en `America/Bogota`.

## Requisitos

- Docker y Docker Compose en la VPS.
- La red `sgcrc` (se crea una sola vez, ver abajo).
- El DNS de `sgcr.myconnectfibraoptica.com` apuntando a la VPS. Sin eso, Caddy no puede emitir el certificado.

## Primer despliegue

```bash
git clone <repo> sgcrc && cd sgcrc

# 1. Red compartida con Caddy (idempotente; no pertenece a ningún stack)
docker network create sgcrc

# 2. Entorno
cp backend/.env.docker.example backend/.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# pegar el resultado en JWT_SECRET y completar SMTP_* con las credenciales reales

# 3. Levantar
docker compose up -d --build
docker compose ps
```

`docker compose ps` debe mostrar `sgcrc-api` y `sgcrc-web` en `healthy`. Si `api` tarda, es la verificación SMTP de arranque (hasta 120 s): revisar `docker compose logs -f api`.

Comprobar sin salir de la red:

```bash
docker exec sgcrc-web wget -qO- http://127.0.0.1/api/health   # {"status":"ok"}
docker exec sgcrc-api id -u                                   # 1000
```

### Si falta la red

`docker compose up` falla con `network sgcrc declared as external, but could not be found`. Solución:

```bash
docker network create sgcrc
```

## Conectar Caddy (sin downtime)

```bash
docker network connect sgcrc myconnect-caddy-1
docker exec myconnect-caddy-1 getent hosts sgcrc-web
docker exec myconnect-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

`docker network connect` es en caliente y `caddy reload` no corta las conexiones existentes. Si el contenedor ya estaba conectado, el primer comando responde `already exists` y no pasa nada.

El bloque del Caddyfile (gestionado en el repo de myconnect):

```
sgcr.myconnectfibraoptica.com {
    encode zstd gzip
    reverse_proxy sgcrc-web:80
}
```

### Persistir la red en myconnect

`docker network connect` no sobrevive a una recreación del contenedor. Añadir al compose de myconnect:

```yaml
services:
  caddy:
    networks:
      - default        # la red que ya use
      - sgcrc

networks:
  sgcrc:
    external: true
```

## Migrar la base actual

Con el backend anterior detenido (para que el WAL quede consistente):

```bash
docker compose stop api
docker run --rm \
  -v sgcrc_data:/data \
  -v "$PWD/backend/data":/src \
  alpine sh -c "cp /src/sgcrc.db* /data/ 2>/dev/null; chown -R 1000:1000 /data"
docker compose start api
docker compose logs --tail 20 api
```

Si la base no existe, el contenedor la crea vacía al arrancar.

## Actualizar

```bash
git pull
docker compose up -d --build
docker compose ps
```

## Backup y restauración

```bash
# Backup (deja el tar en el directorio actual)
docker run --rm -v sgcrc_data:/data -v "$PWD":/backup \
  alpine tar czf /backup/sgcrc-$(date +%F).tar.gz -C /data .

# Restauración
docker compose stop api
docker run --rm -v sgcrc_data:/data -v "$PWD":/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/sgcrc-2026-10-28.tar.gz -C /data && chown -R 1000:1000 /data"
docker compose start api
```

## Diagnóstico

```bash
docker compose logs -f api              # scheduler, SMTP, errores
docker compose logs -f web
docker compose ps                       # estado de los healthchecks
docker exec sgcrc-web nginx -t          # sintaxis de nginx
docker exec myconnect-caddy-1 getent hosts sgcrc-web   # DNS entre contenedores
```

Consultar la base sin entrar al contenedor:

```bash
docker exec sgcrc-api node -e "const d=require('better-sqlite3')('/app/data/sgcrc.db');console.log(d.prepare('select count(*) as usuarios from usuarios').get())"
```

**502 desde Caddy:** casi siempre `myconnect-caddy-1` no está en la red `sgcrc`, o `sgcrc-web` no está arriba. Comprobar con los dos comandos de arriba.

**`permission denied` en `/app/data`:** el volumen quedó con otro dueño (por ejemplo tras una restauración). Corregir con `chown -R 1000:1000` como en la restauración.

## Advertencias

- **Una sola réplica de `api`.** No usar `docker compose up --scale`: el mutex del scheduler es en memoria y se duplicarían correos.
- **No ejecutar `POST /run`** ni pulsar "Enviar" en el Dashboard durante pruebas: envía correos reales.
- **Primer arranque:** `COBROS_REINTENTO_DIAS=0` durante al menos 7 días, para no reenviar cobros anteriores al despliegue.
- **Cambiar `JWT_SECRET`** invalida todas las sesiones: los usuarios deben volver a iniciar sesión.
- No ejecutar `npm test` dentro del contenedor de producción: escribe usuarios temporales en la base real.
