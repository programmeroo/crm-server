import 'reflect-metadata';
import express from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { DataSource } from 'typeorm';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { AuthService } from './services/AuthService';
import { AuditService } from './services/AuditService';
import { AuthController } from './controllers/AuthController';
import { AuditController } from './controllers/AuditController';
import { createApiKeyAuth } from './middlewares/apiKeyAuth';
import { createAuditMiddleware } from './middlewares/auditMiddleware';

export function createApp(dataSource: DataSource): express.Application {
  const app = express();

  // Make DataSource available to controllers/services
  app.set('dataSource', dataSource);

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting (skip in test)
  if (!env.isTest) {
    app.use(rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }));
  }

  // Session
  const sessionConfig: session.SessionOptions = {
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  if (!env.isTest) {
    const connectSqlite3 = require('connect-sqlite3');
    const SQLiteStore = connectSqlite3(session);
    sessionConfig.store = new SQLiteStore({
      db: 'sessions.db',
      dir: path.dirname(env.dbPath),
    });
  }

  app.use(session(sessionConfig));

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  // Static files
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // --- Services ---
  const authService = new AuthService(dataSource);
  const auditService = new AuditService(dataSource);

  // Audit middleware (cross-cutting, before routes)
  app.use(createAuditMiddleware(auditService));

  // --- Routes ---

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok' }, error: null });
  });

  // Auth
  const authController = new AuthController(authService);
  app.use('/api/auth', authController.router);

  // API key auth for all /api/ routes (except /api/auth)
  app.use('/api', createApiKeyAuth(authService));

  // Protected test route (requires API key)
  app.get('/api/protected', (req, res, next) => {
    if (!req.apiUser) {
      next(new (require('./errors/AppError').AppError)('UNAUTHORIZED', 'API key required', 401));
      return;
    }
    res.json({
      data: { user: req.apiUser.email, scopes: req.apiScopes },
      error: null,
    });
  });

  // Audit logs
  const auditController = new AuditController(auditService);
  app.use('/api/audit-logs', auditController.router);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
