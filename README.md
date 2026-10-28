# ☕ SGCRC - Sistema de Gestión de Cobros Recurrentes

Automatiza el envío de recordatorios de cobro y la gestión de suscripciones recurrentes. Combina un backend en Node.js con un dashboard en React para centralizar la operación comercial.

## Características principales

- **Automatización de cobros:** Scheduler integrado que procesa cobros diariamente a las 08:00 AM (hora Colombia, configurable).
- **Dashboard administrativo:** KPIs en tiempo real (ingresos mensuales, clientes activos, estados de envío).
- **Catálogo de planes:** Planes reutilizables con frecuencia mensual, quincenal, semanal o anual.
- **Historial de envíos:** Registro de cada correo con monto, estado y trazabilidad.
- **Multi-tenant:** Múltiples usuarios con datos completamente aislados.
- **Despliegue en contenedores:** dos contenedores Docker (API y nginx) en una VPS, detrás del Caddy que ya corre allí. No publica puertos en el host.

## Stack tecnológico

**Backend**
- Node.js (servidor HTTP nativo, sin Express)
- SQLite con `better-sqlite3` (modo WAL, foreign keys)
- JWT (`jsonwebtoken`) + bcrypt para autenticación
- Nodemailer (SMTP, por defecto Gmail)
- node-cron (scheduler diario)

**Frontend**
- React 18 + Vite
- CSS propio con tokens (`src/styles/`), sin Tailwind
- SPA con navegación por estado (sin React Router)
- JWT almacenado en `localStorage`

**Infraestructura**
- Docker Compose: `sgcrc-api` (Node 22) y `sgcrc-web` (nginx 1.27)
- Caddy existente en la VPS: terminación TLS y proxy hacia `sgcrc-web:80`

## Instalación (desarrollo)

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Editar .env: SMTP_*, PORT, CRON_HORA, CRON_MIN, JWT_SECRET
npm run dev

# Frontend (en otra terminal)
cd sgcrc-frontend-export
npm install
npm run dev
# Acceder en http://localhost:5173
```

Ver `backend/README.md` para documentación completa de la API y configuración SMTP.

## Despliegue en producción

El despliegue es con Docker en la VPS, detrás del Caddy que ya corre allí. Guía completa, con migración de la base, backups y diagnóstico: [`docs/despliegue-docker.md`](docs/despliegue-docker.md).

```bash
docker compose up -d --build
docker compose ps
```

## Tests

```bash
cd backend && npm run test:unit   # lógica pura: cobros, perfil, mailer, config
cd backend && npm test            # smoke de la API (levanta su propio servidor)
cd sgcrc-frontend-export && npm test
```

`test:security`, `test:integration` y `npm test` del backend escriben usuarios temporales en `backend/data/sgcrc.db`. No ejecutarlos contra la base de producción.

---

Desarrollado por: Jarol Medina
