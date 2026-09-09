import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import { verifyCsrf } from './middleware/csrf.js';
import authRoutes from './routes/auth.js';
import clientsRoutes from './routes/clients.js';
import executivesRoutes from './routes/executives.js';
import serviceLinesRoutes from './routes/serviceLines.js';
import quotationsRoutes from './routes/quotations.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Railway (and Vercel) terminate TLS one hop upstream and forward plain HTTP,
  // so Express must trust the X-Forwarded-* headers from that single proxy hop.
  // Without this, req.secure/req.protocol never reflect X-Forwarded-Proto, which
  // silently breaks secure session cookies (express-session refuses to set
  // Set-Cookie when cookie.secure is true but req.secure is false) and breaks
  // express-rate-limit's per-IP keying (falls back to the proxy's IP).
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json({ limit: '3mb' }));

  app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    name: 'vv_sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000
    }
  }));

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use('/auth', authRoutes);
  app.use('/clients', requireAuth, verifyCsrf, clientsRoutes);
  app.use('/executives', requireAuth, verifyCsrf, executivesRoutes);
  app.use('/service-lines', requireAuth, verifyCsrf, serviceLinesRoutes);
  app.use('/quotations', requireAuth, verifyCsrf, quotationsRoutes);
  app.use('/dashboard', requireAuth, dashboardRoutes);
  app.use('/settings', requireAuth, verifyCsrf, settingsRoutes);

  app.use((req, res) => res.status(404).json({ error: 'No encontrado.' }));
  app.use(errorHandler);

  return app;
}
