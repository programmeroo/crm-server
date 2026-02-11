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
import { WorkspaceService } from './services/WorkspaceService';
import { ContactService } from './services/ContactService';
import { ListService } from './services/ListService';
import { CustomFieldService } from './services/CustomFieldService';
import { TemplateService } from './services/TemplateService';
import { PromptFileService } from './services/PromptFileService';
import { CampaignService } from './services/CampaignService';
import { AuthController } from './controllers/AuthController';
import { AuditController } from './controllers/AuditController';
import { WorkspaceController } from './controllers/WorkspaceController';
import { ContactController } from './controllers/ContactController';
import { ListController } from './controllers/ListController';
import { CustomFieldController } from './controllers/CustomFieldController';
import { TemplateController } from './controllers/TemplateController';
import { PromptController } from './controllers/PromptController';
import { DashboardController } from './controllers/DashboardController';
import { SettingsUIController } from './controllers/SettingsUIController';
import { ContactUIController } from './controllers/ContactUIController';
import { WorkspaceUIController } from './controllers/WorkspaceUIController';
import { TemplateUIController } from './controllers/TemplateUIController';
import { CampaignController } from './controllers/CampaignController';
import { CampaignUIController } from './controllers/CampaignUIController';
import { createApiKeyAuth } from './middlewares/apiKeyAuth';
import { createAuditMiddleware } from './middlewares/auditMiddleware';
import expressLayouts from 'express-ejs-layouts';
import { Workspace } from './entities/Workspace.entity';

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
  app.use(expressLayouts);
  app.set('layout', 'layout'); // refers to views/layout.ejs

  // Static files
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // --- Services ---
  const authService = new AuthService(dataSource);
  const auditService = new AuditService(dataSource);
  const workspaceService = new WorkspaceService(dataSource);
  const contactService = new ContactService(dataSource);
  const listService = new ListService(dataSource);
  const customFieldService = new CustomFieldService(dataSource);
  const templateService = new TemplateService(dataSource);
  const promptFileService = new PromptFileService();
  const campaignService = new CampaignService(dataSource);

  // Audit middleware (cross-cutting, before routes)
  app.use(createAuditMiddleware(auditService));

  // --- UI Locals Middleware ---
  app.use(async (req, res, next) => {
    if ((req.session as any)?.userId) {
      const userId = (req.session as any).userId;
      try {
        const workspaces = await workspaceService.listByUser(userId);
        res.locals.workspaces = workspaces;
        res.locals.user = {
          name: (req.session as any).name || 'User',
          email: (req.session as any).email
        };
        // Default values for pages that might forget them
        res.locals.activePage = '';
        res.locals.currentWorkspaceId = null;
        res.locals.pageTitle = 'Pi-CRM';
      } catch (err) {
        res.locals.workspaces = [];
      }
    } else {
      res.locals.workspaces = [];
      res.locals.user = null;
    }
    next();
  });

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
  app.get('/api/protected', (req: any, res, next) => {
    if (!req.apiUser) {
      next(new (require('./errors/AppError').AppError)('UNAUTHORIZED', 'API key required', 401));
      return;
    }
    res.json({
      data: { user: req.apiUser.email, scopes: req.apiScopes },
      error: null,
    });
  });

  // Workspaces
  const workspaceController = new WorkspaceController(workspaceService);
  app.use('/api/workspaces', workspaceController.router);

  // Dashboard (UI)
  const dashboardController = new DashboardController(workspaceService, contactService, campaignService);
  app.use('/dashboard', dashboardController.router);

  // Redirect root to dashboard
  app.get('/', (req, res) => {
    res.redirect('/dashboard');
  });

  // Basic login route
  app.get('/login', (req, res) => {
    res.render('login', { title: 'Login', layout: false });
  });

  // UI Logout
  app.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  });

  const workspaceUIController = new WorkspaceUIController(workspaceService, contactService, listService);
  app.use('/workspaces', workspaceUIController.router);

  const contactUIController = new ContactUIController(contactService, workspaceService, customFieldService, listService);
  app.use('/contacts', contactUIController.router);

  const templateUIController = new TemplateUIController(templateService, workspaceService);
  app.use('/templates', templateUIController.router);

  const campaignUIController = new CampaignUIController(campaignService, workspaceService, templateService, listService);
  app.use('/campaigns', campaignUIController.router);

  const settingsUIController = new SettingsUIController(promptFileService, workspaceService, listService);
  app.use('/settings', settingsUIController.router);

  // API - Contacts
  const contactController = new ContactController(contactService, workspaceService);
  app.use('/api/contacts', contactController.router);

  // Lists
  const listController = new ListController(listService, workspaceService, contactService);
  app.use('/api/lists', listController.router);

  // Custom Fields
  const customFieldController = new CustomFieldController(customFieldService, contactService);
  app.use('/api/custom-fields', customFieldController.router);

  // Templates
  const templateController = new TemplateController(templateService, workspaceService);
  app.use('/api/templates', templateController.router);

  // Campaigns
  const campaignController = new CampaignController(campaignService, workspaceService);
  app.use('/api/campaigns', campaignController.router);

  // Prompts
  const promptController = new PromptController(promptFileService, workspaceService, listService);
  app.use('/api/prompts', promptController.router);

  // Audit logs
  const auditController = new AuditController(auditService);
  app.use('/api/audit-logs', auditController.router);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
