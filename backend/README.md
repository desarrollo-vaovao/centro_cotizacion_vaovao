# Centro de Cotizaciones — Backend

API REST en Node.js/Express + PostgreSQL para el Centro de Cotizaciones de VaoVao.

## Desarrollo local

1. `docker compose up -d` — levanta Postgres local.
2. `docker compose exec postgres psql -U vv_user -d vaovao_dev -c "CREATE DATABASE vaovao_test;"` — crea la base de pruebas (una sola vez).
3. `cp .env.example .env` y `cp .env.test.example .env.test` — completa los valores.
4. `npm install`
5. `npm run migrate` — aplica el esquema a `vaovao_dev`.
6. `npm run seed` — crea el usuario admin definido por `ADMIN_EMAIL`/`ADMIN_PASSWORD` en `.env`.
7. `npm run dev` — corre el servidor en `http://localhost:4000` con recarga automática.
8. `npm test` — corre la suite completa contra `vaovao_test` (aplica migraciones automáticamente).

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Postgres. |
| `PGSSL` | `false` en local; cualquier otro valor activa SSL (usar en Railway). |
| `TZ` | Zona horaria del proceso — debe ser `America/Guatemala`. |
| `SESSION_SECRET` | Secreto para firmar la cookie de sesión. |
| `FRONTEND_ORIGIN` | Origen exacto permitido por CORS (la URL de Vercel en producción). |
| `PORT` | Puerto del servidor (Railway lo inyecta automáticamente). |
| `NODE_ENV` | `production` en Railway — activa cookies `secure`/`sameSite=none`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Usados solo por `npm run seed`. |
| `LOGIN_RATE_LIMIT` | Solo para pruebas; en producción usa el valor por defecto (5). |

## Despliegue en Railway

1. Crea un servicio Postgres en el mismo proyecto de Railway.
2. Activa los backups automáticos del servicio Postgres (pestaña "Backups" del servicio en Railway) — son datos sensibles de clientes y cotizaciones, no deben depender de un solo respaldo manual.
3. Crea el servicio del backend con directorio raíz `backend/` (o despliega solo esta carpeta).
4. Define las variables de entorno de la tabla anterior (`DATABASE_URL` normalmente lo provee Railway al enlazar el servicio de Postgres).
5. El primer deploy aplica migraciones automáticamente (`railway.json`). Corre `npm run seed` una vez manualmente (Railway CLI o shell del servicio) para crear el usuario admin.
