import rateLimit from 'express-rate-limit';

export function createLoginLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: (req, res) => Number(process.env.LOGIN_RATE_LIMIT) || 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Intenta de nuevo en un minuto.' }
  });
}
