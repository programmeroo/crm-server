import 'reflect-metadata';
import express from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { DataSource } from 'typeorm';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';

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

  // --- Routes ---

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok' }, error: null });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
