# Centro de Cotizaciones VaoVao — Diseño

Fecha: 2026-09-08
Estado: Aprobado por el usuario, pendiente de plan de implementación

## 1. Contexto y objetivo

Existe un prototipo HTML de una sola página (`centro-cotizaciones_10.html`) que implementa un
centro de cotizaciones para la agencia VaoVao: dashboard con KPIs y gráficas, alta de
cotizaciones, historial con versionado/ajuste, ficha de cliente, catálogo (clientes,
ejecutivos, líneas de servicio, logos) y generación de PDF. El prototipo no tiene backend real
ni autenticación — persiste todo en un `window.storage` de tipo mock (almacenamiento personal
del entorno donde se generó el prototipo).

El objetivo es convertir ese prototipo en un producto real: mismas pantallas y flujos
(funcionalidad idéntica al mockup), con backend propio, base de datos real y login. No se
agregan funcionalidades nuevas en esta primera fase — cualquier cambio de alcance se pide por
separado después de tener el sistema base funcionando.

## 2. Usuarios y alcance

- Un solo equipo interno de VaoVao, un solo rol — todos los usuarios autenticados tienen los
  mismos permisos (crear/ver/ajustar cotizaciones, gestionar catálogo, ver dashboard).
- No hay registro público. Las cuentas se crean manualmente (seed inicial / acceso directo a
  la base de datos), no hay pantalla de "crear cuenta".
- No es multi-tenant: todos los datos pertenecen a una sola organización (VaoVao).

## 3. Arquitectura general

```
┌─────────────────────┐        HTTPS/JSON         ┌──────────────────────┐
│   Frontend (Vercel)  │ ────────────────────────▶ │   Backend (Railway)   │
│  React + Vite (SPA)  │ ◀──────────────────────── │  Node.js + Express    │
│  React Router        │   cookie httpOnly de sesión│  PostgreSQL (Railway) │
└──────────────────────┘                             └──────────────────────┘
```

- **Backend**: Node.js + Express, API REST, PostgreSQL administrado por Railway (mismo
  proyecto de Railway que el servicio).
- **Frontend**: React + Vite, desplegado como sitio estático en Vercel. Se eligió sobre
  Next.js porque es una herramienta interna sin necesidad de SSR/SEO — Vite es más liviano y
  suficiente para un dashboard de este tamaño.
- **PDF**: se mantiene igual que el mockup — generación client-side con html2canvas + jsPDF,
  sin involucrar al backend.
- **CORS**: el backend habilita CORS solo para el origen del frontend en Vercel, con
  `credentials: true` (necesario para que la cookie de sesión viaje entre dominios).

## 4. Seguridad y autenticación

Dado que el sistema maneja datos sensibles (montos de cotizaciones, datos de contacto de
clientes), se prioriza el mecanismo más seguro sobre el más simple:

- **Sesión por cookie `httpOnly`, `Secure`, `SameSite=None`** — no JWT en localStorage, para
  que el token de sesión nunca sea accesible desde JavaScript (mitiga robo por XSS). Como
  frontend y backend están en dominios distintos (vercel.app / railway.app), `SameSite=None`
  es obligatorio para que la cookie viaje entre ambos.
- **Protección CSRF**: token de doble verificación — el backend lo entrega tras el login, el
  frontend lo reenvía en el header de cada request que modifica datos (POST/PUT/PATCH/DELETE).
  Necesario porque `SameSite=None` no ofrece la protección CSRF que da `Lax/Strict`.
- **Contraseñas**: hasheadas con `bcrypt`, nunca en texto plano ni reversibles.
- **Rate limiting** en `POST /auth/login`: máximo 5 intentos por minuto por IP, para frenar
  fuerza bruta.
- **Expiración de sesión**: ~8 horas, renovable mientras el usuario esté activo.
- **HTTPS obligatorio** en ambos extremos (por defecto en Railway y Vercel).
- **Validación de entrada en el backend** para todos los formularios (cliente, ejecutivo,
  cotización) — la validación del frontend es solo UX, no la única línea de defensa.
- **Secrets** (contraseña de base de datos, clave de firma de sesión/CSRF) como variables de
  entorno en Railway; nunca en el repositorio.
- **Backups automáticos** de Postgres activados en Railway.

## 5. Modelo de datos (PostgreSQL)

Tablas, calcadas de las entidades que ya usa el mockup:

- **`users`** — `id`, `email` (único), `password_hash`, `name`, `created_at`
- **`clients`** — `id`, `code` (único), `name`, `country`, `contact_name`, `contact_email`,
  `contact_phone`, `seq` (contador de correlativo por cliente)
- **`executives`** — `id`, `name`
- **`service_lines`** — `id`, `name`, `order`
- **`quotations`** — `id`, `correlativo_general`, `correlativo_cliente`, `fecha`,
  `validez_dias`, `client_id` (FK nullable), `cliente_nombre_libre`, `pais`, `linea_servicio`,
  `executive_id` (FK nullable), `proyecto`, `descripcion`, `detalle` (JSON, array de strings),
  `monto`, `impuestos`, `moneda`, `estatus`, `fecha_aprobacion`, `fecha_cierre_proyecto`,
  `observaciones`, `version`, `previous_version_id` (FK a `quotations.id`, nullable),
  `superseded_by` (FK a `quotations.id`, nullable), `root_id`
- **`settings`** — fila única con `general_seq` (contador del correlativo general) y los 2
  logos (`logo_agencia`, `logo_velarc`) guardados como base64 directamente en la base de
  datos — son solo 2 imágenes pequeñas (máx. ~1.5MB cada una, mismo límite que ya aplica el
  mockup), no justifica un servicio de storage aparte.

Estados de `estatus`: `Enviada`, `En Proceso - Cliente`, `Aprobada`, `Denegada`, `Sustituida`
(este último se asigna automáticamente al ajustar una cotización, igual que en el mockup).

## 6. API REST

Todos los endpoints requieren sesión válida excepto `POST /auth/login`.

- `POST /auth/login` — email + password → set-cookie de sesión + token CSRF
- `POST /auth/logout` — invalida la sesión
- `GET /auth/me` — usuario actual (para que el frontend sepa si hay sesión al cargar)
- `GET /clients`, `POST /clients`, `PATCH /clients/:id`
- `GET /executives`, `POST /executives`
- `GET /service-lines`, `POST /service-lines`, `PATCH /service-lines/:id`,
  `DELETE /service-lines/:id`
- `GET /quotations`, `POST /quotations`, `PATCH /quotations/:id` (cambios de estatus y
  fechas), `POST /quotations/:id/adjust` (crea una nueva versión y marca la original como
  `Sustituida`, misma lógica de versionado del mockup)
- `GET /dashboard?period=&clientId=` — KPIs y agregados (tendencia mensual, cotizado por
  cliente, líneas de servicio, ranking de ejecutivos) calculados en el backend, no en el
  navegador — evita traer todas las cotizaciones al cliente para cada vista del dashboard.
- `GET /settings/logos`, `PUT /settings/logos`

Esto reemplaza 1:1 las funciones del mockup que hoy leen/escriben en `window.storage`
(`storeGet` / `storeSet`).

## 7. Estructura del frontend

```
src/
  api/            # cliente fetch, un archivo por recurso (clients.js, quotations.js, auth.js...)
  pages/          # Dashboard, NuevaCotizacion, Historial, FichaCliente, Catalogo, DocView, Login
  components/     # KPI card, gráficas (wrappers de Chart.js), tabla, formularios reutilizables
  context/        # AuthContext (usuario actual, login/logout)
  App.jsx         # React Router: rutas protegidas redirigen a /login si no hay sesión
```

Mapea 1:1 a las vistas del mockup (`dashboard`, `nueva`/`ajustar`, `historial`, `ficha`,
`catalogo`, `doc`) más una vista nueva de `Login`. Las gráficas siguen usando Chart.js, y el
PDF sigue generándose con html2canvas + jsPDF, igual que en el mockup.

## 8. Fases de construcción

1. **Backend base** — proyecto Express en Railway, conexión a Postgres, migraciones de las
   tablas descritas en la sección 5.
2. **Auth** — login/logout/me con cookies httpOnly + CSRF + bcrypt + rate limiting.
3. **API de datos** — endpoints de clients, executives, service-lines, quotations (incluye
   versionado/ajuste de cotizaciones).
4. **API de dashboard** — agregados y KPIs.
5. **Frontend base** — scaffold Vite+React, routing, AuthContext, pantalla de Login conectada
   al backend.
6. **Frontend de datos** — Nueva cotización, Historial, Ficha de cliente, Catálogo
   (conectados a la API real).
7. **Dashboard** — KPIs y gráficas conectadas al endpoint de agregados.
8. **Documento/PDF** — vista de documento + descarga PDF (client-side, igual al mockup).
9. **Despliegue** — backend a Railway, frontend a Vercel, variables de entorno, prueba
   end-to-end (login → crear cotización → ver en historial → ajustar → ver dashboard → PDF).

## 9. Fuera de alcance (por ahora)

- Roles diferenciados (admin vs. ejecutivo) — todos los usuarios tienen los mismos permisos.
- Multi-tenant / múltiples organizaciones.
- Registro público de usuarios.
- Registro de auditoría (quién cambió qué) — no existe en el mockup, no se agrega salvo que
  se pida explícitamente.
- Recuperación de contraseña autoservicio ("olvidé mi contraseña" por correo) — si un usuario
  la olvida, se resetea manualmente (acceso directo a la base de datos), consistente con que
  las cuentas también se crean manualmente.
- Cualquier funcionalidad no presente en el mockup de referencia.
