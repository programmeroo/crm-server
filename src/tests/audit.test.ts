import request, { Test } from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { DataSource } from 'typeorm';
import { createApp } from '../app';
import { createDataSource, initializeDatabase } from '../config/database';
import { AuditService } from '../services/AuditService';
import { AuthService } from '../services/AuthService';
import { AuditLog } from '../entities/AuditLog.entity';

describe('Audit Logging', () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;
  let auditService: AuditService;
  let authService: AuthService;
  let userId: string;

  beforeAll(async () => {
    dataSource = createDataSource({ database: ':memory:', synchronize: true });
    await initializeDatabase(dataSource);
    app = createApp(dataSource);
    auditService = new AuditService(dataSource);
    authService = new AuthService(dataSource);

    const user = await authService.register('audit@example.com', 'password123', 'Audit User');
    userId = user.id;
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('AuditService', () => {
    it('should log an action with all fields', async () => {
      const log = await auditService.logAction({
        userId,
        action: 'user.login',
        entityType: 'user',
        entityId: userId,
        details: JSON.stringify({ method: 'session' }),
        ipAddress: '127.0.0.1',
      });

      expect(log.id).toBeDefined();
      expect(log.user_id).toBe(userId);
      expect(log.action).toBe('user.login');
      expect(log.entity_type).toBe('user');
      expect(log.entity_id).toBe(userId);
      expect(log.details).toBe(JSON.stringify({ method: 'session' }));
      expect(log.ip_address).toBe('127.0.0.1');
      expect(log.timestamp).toBeDefined();
    });

    it('should log an action with nullable fields omitted', async () => {
      const log = await auditService.logAction({
        userId: null,
        action: 'system.startup',
      });

      expect(log.id).toBeDefined();
      expect(log.user_id).toBeNull();
      expect(log.action).toBe('system.startup');
      expect(log.entity_type).toBeNull();
      expect(log.entity_id).toBeNull();
      expect(log.details).toBeNull();
      expect(log.ip_address).toBeNull();
    });

    it('should retrieve logs by entity', async () => {
      await auditService.logAction({
        userId,
        action: 'contact.create',
        entityType: 'contact',
        entityId: 'contact-1',
      });

      await auditService.logAction({
        userId,
        action: 'contact.update',
        entityType: 'contact',
        entityId: 'contact-1',
      });

      const logs = await auditService.getLogsByEntity('contact', 'contact-1');
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.every(l => l.entity_type === 'contact' && l.entity_id === 'contact-1')).toBe(true);
    });

    it('should retrieve logs by user', async () => {
      const logs = await auditService.getLogsByUser(userId);
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.every(l => l.user_id === userId)).toBe(true);
    });

    it('should retrieve logs with pagination', async () => {
      const page1 = await auditService.getLogs({ limit: 2, offset: 0 });
      expect(page1.length).toBeLessThanOrEqual(2);

      const page2 = await auditService.getLogs({ limit: 2, offset: 2 });
      if (page1.length > 0 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });

    it('should return logs in descending timestamp order', async () => {
      const logs = await auditService.getLogs({ limit: 10, offset: 0 });
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i - 1].timestamp >= logs[i].timestamp).toBe(true);
      }
    });
  });

  describe('Audit Middleware (cross-cutting)', () => {
    it('should log login actions automatically', async () => {
      const beforeLogs = await auditService.getLogsByAction('user.login');
      const beforeCount = beforeLogs.length;

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'audit@example.com', password: 'password123' });

      const afterLogs = await auditService.getLogsByAction('user.login');
      expect(afterLogs.length).toBe(beforeCount + 1);
    });

    it('should log failed login attempts', async () => {
      const beforeLogs = await auditService.getLogsByAction('user.login_failed');
      const beforeCount = beforeLogs.length;

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'audit@example.com', password: 'wrongpassword' });

      const afterLogs = await auditService.getLogsByAction('user.login_failed');
      expect(afterLogs.length).toBe(beforeCount + 1);
    });

    it('should log logout actions', async () => {
      const agent = request.agent(app);
      await agent
        .post('/api/auth/login')
        .send({ email: 'audit@example.com', password: 'password123' });

      const beforeLogs = await auditService.getLogsByAction('user.logout');
      const beforeCount = beforeLogs.length;

      await agent.post('/api/auth/logout');

      const afterLogs = await auditService.getLogsByAction('user.logout');
      expect(afterLogs.length).toBe(beforeCount + 1);
    });

    it('should capture IP address in audit logs', async () => {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ email: 'audit@example.com', password: 'password123' });

      const logs = await auditService.getLogsByAction('user.login');
      const latest = logs[0];
      expect(latest.ip_address).toBeDefined();
    });
  });

  describe('Audit API', () => {
    let agent: TestAgent<Test>;

    beforeAll(async () => {
      agent = request.agent(app);
      await agent
        .post('/api/auth/login')
        .send({ email: 'audit@example.com', password: 'password123' });
    });

    it('GET /api/audit-logs should return paginated logs', async () => {
      const res = await agent.get('/api/audit-logs?limit=5&offset=0');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.error).toBeNull();
    });

    it('GET /api/audit-logs should filter by action', async () => {
      const res = await agent.get('/api/audit-logs?action=user.login');
      expect(res.status).toBe(200);
      expect(res.body.data.every((l: AuditLog) => l.action === 'user.login')).toBe(true);
    });

    it('GET /api/audit-logs should filter by entity', async () => {
      const res = await agent.get('/api/audit-logs?entityType=user');
      expect(res.status).toBe(200);
      expect(res.body.data.every((l: AuditLog) => l.entity_type === 'user')).toBe(true);
    });

    it('GET /api/audit-logs should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/audit-logs');
      expect(res.status).toBe(401);
    });
  });
});
