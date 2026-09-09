# Centro de Cotizaciones — Frontend

React + Vite SPA para el Centro de Cotizaciones de VaoVao.

## Desarrollo local

1. Asegúrate de que el backend esté corriendo (ver `backend/README.md`) — por defecto en `http://localhost:4000`.
2. `cp .env.example .env` y ajusta `VITE_API_URL` si el backend corre en otro puerto/host.
3. `npm install`
4. `npm run dev` — abre `http://localhost:5173`.
5. `npm test` — corre la suite completa (mockea la capa `api/`, no requiere el backend corriendo).

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base del backend (debe empezar con `VITE_` para que Vite la exponga al cliente). En producción, la URL del servicio de Railway. |

## Despliegue en Vercel

1. Importa el repo en Vercel, con directorio raíz `frontend/`.
2. Define `VITE_API_URL` como variable de entorno de producción, apuntando a la URL pública del backend en Railway.
3. Vercel detecta Vite automáticamente; `vercel.json` ya incluye el rewrite necesario para que las rutas de React Router funcionen en despliegue (sin él, recargar `/historial` daría 404).
4. En el backend, actualiza `FRONTEND_ORIGIN` a la URL de Vercel una vez desplegado (necesario para que CORS acepte las peticiones).
