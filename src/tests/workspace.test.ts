import request, { Test } from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { DataSource } from 'typeorm';
import { createApp } from '../app';
import { createDataSource, initializeDatabase } from '../config/database';
import { AuthService } from '../services/AuthService';
import { WorkspaceService } from '../services/WorkspaceService';

describe('Workspaces', () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;
  let authService: AuthService;
  let workspaceService: WorkspaceService;
  let andyId: string;
  let monalisaId: string;

  beforeAll(async () => {
    dataSource = createDataSource({ database: ':memory:', synchronize: true });
    await initializeDatabase(dataSource);
    app = createApp(dataSource);
    authService = new AuthService(dataSource);
    workspaceService = new WorkspaceService(dataSource);

    const andy = await authService.register('andy@example.com', 'password123', 'Andy');
    andyId = andy.id;
    const monalisa = await authService.register('monalisa@example.com', 'password123', 'Monalisa');
    monalisaId = monalisa.id;
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('WorkspaceService', () => {
    it('should create a workspace', async () => {
      const ws = await workspaceService.create(andyId, 'Personal');
      expect(ws.id).toBeDefined();
      expect(ws.user_id).toBe(andyId);
      expect(ws.name).toBe('Personal');
      expect(ws.created_at).toBeDefined();
    });

    it('should reject duplicate workspace name for same user', async () => {
      await expect(workspaceService.create(andyId, 'Personal'))
        .rejects.toThrow('Workspace name already exists');
    });

    it('should allow same name for different users', async () => {
      const ws = await workspaceService.create(monalisaId, 'Personal');
      expect(ws.user_id).toBe(monalisaId);
      expect(ws.name).toBe('Personal');
    });

    it('should list workspaces by user', async () => {
      await workspaceService.create(andyId, 'Business');
      const andyWorkspaces = await workspaceService.listByUser(andyId);
      const monalisaWorkspaces = await workspaceService.listByUser(monalisaId);
      expect(andyWorkspaces.length).toBe(2);
      expect(monalisaWorkspaces.length).toBe(1);
    });

    it('should update workspace name', async () => {
      const workspaces = await workspaceService.listByUser(andyId);
      const ws = workspaces.find(w => w.name === 'Business')!;
      const updated = await workspaceService.update(ws.id, andyId, 'Work');
      expect(updated.name).toBe('Work');
    });

    it('should reject update by wrong user', async () => {
      const workspaces = await workspaceService.listByUser(andyId);
      await expect(workspaceService.update(workspaces[0].id, monalisaId, 'Stolen'))
        .rejects.toThrow('Not your workspace');
    });

    it('should delete workspace', async () => {
      const ws = await workspaceService.create(andyId, 'ToDelete');
      await workspaceService.delete(ws.id, andyId);
      const found = await workspaceService.findById(ws.id);
      expect(found).toBeNull();
    });

    it('should reject delete by wrong user', async () => {
      const workspaces = await workspaceService.listByUser(andyId);
      await expect(workspaceService.delete(workspaces[0].id, monalisaId))
        .rejects.toThrow('Not your workspace');
    });
  });

  describe('Workspace API', () => {
    let andyAgent: TestAgent<Test>;
    let monalisaAgent: TestAgent<Test>;

    beforeAll(async () => {
      andyAgent = request.agent(app);
      await andyAgent
        .post('/api/auth/login')
        .send({ email: 'andy@example.com', password: 'password123' });

      monalisaAgent = request.agent(app);
      await monalisaAgent
        .post('/api/auth/login')
        .send({ email: 'monalisa@example.com', password: 'password123' });
    });

    it('POST /api/workspaces should create a workspace', async () => {
      const res = await andyAgent
        .post('/api/workspaces')
        .send({ name: 'API Test Workspace' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('API Test Workspace');
      expect(res.body.error).toBeNull();
    });

    it('POST /api/workspaces should reject empty name', async () => {
      const res = await andyAgent
        .post('/api/workspaces')
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('POST /api/workspaces should reject duplicate name', async () => {
      const res = await andyAgent
        .post('/api/workspaces')
        .send({ name: 'API Test Workspace' });
      expect(res.status).toBe(409);
    });

    it('GET /api/workspaces should list only own workspaces', async () => {
      const andyRes = await andyAgent.get('/api/workspaces');
      const monalisaRes = await monalisaAgent.get('/api/workspaces');

      expect(andyRes.status).toBe(200);
      expect(andyRes.body.data.length).toBeGreaterThan(0);

      const andyIds = andyRes.body.data.map((w: { id: string }) => w.id);
      const monalisaIds = monalisaRes.body.data.map((w: { id: string }) => w.id);
      const overlap = andyIds.filter((id: string) => monalisaIds.includes(id));
      expect(overlap.length).toBe(0);
    });

    it('PUT /api/workspaces/:id should update own workspace', async () => {
      const list = await andyAgent.get('/api/workspaces');
      const wsId = list.body.data[0].id;

      const res = await andyAgent
        .put(`/api/workspaces/${wsId}`)
        .send({ name: 'Renamed Workspace' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Renamed Workspace');
    });

    it('PUT /api/workspaces/:id should reject update by other user', async () => {
      const list = await andyAgent.get('/api/workspaces');
      const wsId = list.body.data[0].id;

      const res = await monalisaAgent
        .put(`/api/workspaces/${wsId}`)
        .send({ name: 'Stolen' });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/workspaces/:id should delete own workspace', async () => {
      const createRes = await andyAgent
        .post('/api/workspaces')
        .send({ name: 'Delete Me' });
      const wsId = createRes.body.data.id;

      const res = await andyAgent.delete(`/api/workspaces/${wsId}`);
      expect(res.status).toBe(200);
    });

    it('DELETE /api/workspaces/:id should reject delete by other user', async () => {
      const list = await andyAgent.get('/api/workspaces');
      const wsId = list.body.data[0].id;

      const res = await monalisaAgent.delete(`/api/workspaces/${wsId}`);
      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/workspaces');
      expect(res.status).toBe(401);
    });
  });
});
