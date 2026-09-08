import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json({ limit: '3mb' }));

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use((req, res) => res.status(404).json({ error: 'No encontrado.' }));
  app.use(errorHandler);

  return app;
}
