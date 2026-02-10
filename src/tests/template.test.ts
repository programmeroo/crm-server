import request from 'supertest';
import { createApp } from '../app';
import { createDataSource, initializeDatabase } from '../config/database';
import { DataSource } from 'typeorm';
import { AuthService } from '../services/AuthService';
import { WorkspaceService } from '../services/WorkspaceService';

describe('Templates', () => {
  let dataSource: DataSource;
  let app: any;
  let authService: AuthService;
  let workspaceService: WorkspaceService;
  let andyId: number;
  let monalisaId: number;
  let andyWorkspaceId: number;
  let monalisaWorkspaceId: number;

  beforeAll(async () => {
    dataSource = createDataSource({
      database: ':memory:',
      synchronize: true,
    });
    await initializeDatabase(dataSource);

    app = createApp(dataSource);
    authService = new AuthService(dataSource);
    workspaceService = new WorkspaceService(dataSource);

    // Create test users
    const andy = await authService.register('andy@example.com', 'password123', 'Andy');
    andyId = andy.id;

    const monalisa = await authService.register('monalisa@example.com', 'password123', 'Monalisa');
    monalisaId = monalisa.id;

    // Create test workspaces
    const andyWorkspace = await workspaceService.create(andyId, 'Loan Factory');
    andyWorkspaceId = andyWorkspace.id;

    const monalisaWorkspace = await workspaceService.create(monalisaId, 'MaiStory');
    monalisaWorkspaceId = monalisaWorkspace.id;
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('TemplateService', () => {
    it('should create a template with all fields (html type)', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const res = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Welcome Email',
        template_type: 'html',
        subject: 'Welcome!',
        body: '<h1>Welcome</h1><p>Thanks for joining.</p>',
        preheader: 'Welcome to our service',
        signature: 'Best regards, Andy',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Welcome Email');
      expect(res.body.data.template_type).toBe('html');
      expect(res.body.data.subject).toBe('Welcome!');
      expect(res.body.data.body).toContain('<h1>Welcome</h1>');
    });

    it('should create a text template', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const res = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Plain Text Template',
        template_type: 'text',
        subject: 'Hello',
        body: 'This is a plain text email template.',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.template_type).toBe('text');
    });

    it('should create a mixed template', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const res = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Mixed Template',
        template_type: 'mixed',
        subject: 'Newsletter',
        body: '<h1>Newsletter</h1><img src="data:image/png;base64,iVBORw0KGgo..." />',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.template_type).toBe('mixed');
    });

    it('should reject duplicate template name in same workspace', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      // Create first template
      await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Unique Name',
        template_type: 'html',
        body: 'Content 1',
        subject: 'Test 1',
      });

      // Try to create duplicate
      const res = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Unique Name',
        template_type: 'html',
        body: 'Content 2',
        subject: 'Test 2',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE');
    });

    it('should allow same template name in different workspaces', async () => {
      const andyAgent = request.agent(app);
      await andyAgent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const monalisaAgent = request.agent(app);
      await monalisaAgent.post('/api/auth/login').send({
        email: 'monalisa@example.com',
        password: 'password123',
      });

      // Andy creates template
      const andyRes = await andyAgent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Same Name',
        template_type: 'html',
        body: 'Andy content',
        subject: 'Andy subject',
      });

      expect(andyRes.status).toBe(201);

      // Monalisa creates template with same name
      const monalisaRes = await monalisaAgent.post('/api/templates').send({
        workspaceId: monalisaWorkspaceId,
        name: 'Same Name',
        template_type: 'html',
        body: 'Monalisa content',
        subject: 'Monalisa subject',
      });

      expect(monalisaRes.status).toBe(201);
    });

    it('should list templates by workspace', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      // Create a few templates
      await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Template A',
        template_type: 'html',
        body: 'Content A',
      });

      await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Template B',
        template_type: 'html',
        body: 'Content B',
      });

      const res = await agent.get('/api/templates').query({ workspaceId: andyWorkspaceId });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Verify order (most recent first)
      if (res.body.data.length > 1) {
        const firstCreatedAt = new Date(res.body.data[0].created_at).getTime();
        const secondCreatedAt = new Date(res.body.data[1].created_at).getTime();
        expect(firstCreatedAt).toBeGreaterThanOrEqual(secondCreatedAt);
      }
    });

    it('should find template by ID', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const createRes = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Get Test Template',
        template_type: 'html',
        body: 'Test content',
        subject: 'Test subject',
      });

      const templateId = createRes.body.data.id;

      const res = await agent.get(`/api/templates/${templateId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(templateId);
      expect(res.body.data.name).toBe('Get Test Template');
    });

    it('should update template with all fields', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const createRes = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Update Test',
        template_type: 'html',
        body: 'Original content',
        subject: 'Original subject',
      });

      const templateId = createRes.body.data.id;

      const res = await agent.put(`/api/templates/${templateId}`).send({
        name: 'Updated Name',
        template_type: 'text',
        body: 'Updated content',
        subject: 'Updated subject',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.template_type).toBe('text');
      expect(res.body.data.body).toBe('Updated content');
    });

    it('should reject update if user does not own workspace', async () => {
      const andyAgent = request.agent(app);
      await andyAgent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const monalisaAgent = request.agent(app);
      await monalisaAgent.post('/api/auth/login').send({
        email: 'monalisa@example.com',
        password: 'password123',
      });

      const createRes = await andyAgent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Andy Only Template',
        template_type: 'html',
        body: 'Content',
      });

      const templateId = createRes.body.data.id;

      const res = await monalisaAgent.put(`/api/templates/${templateId}`).send({
        subject: 'Hacked subject',
      });

      expect(res.status).toBe(403);
    });

    it('should delete template', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const createRes = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Delete Test',
        template_type: 'html',
        body: 'To be deleted',
      });

      const templateId = createRes.body.data.id;

      const deleteRes = await agent.delete(`/api/templates/${templateId}`);
      expect(deleteRes.status).toBe(200);

      // Verify it's deleted
      const getRes = await agent.get(`/api/templates/${templateId}`);
      expect(getRes.status).toBe(404);
    });

    it('should reject delete if user does not own workspace', async () => {
      const andyAgent = request.agent(app);
      await andyAgent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const monalisaAgent = request.agent(app);
      await monalisaAgent.post('/api/auth/login').send({
        email: 'monalisa@example.com',
        password: 'password123',
      });

      const createRes = await andyAgent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Protected Template',
        template_type: 'html',
        body: 'Protected',
      });

      const templateId = createRes.body.data.id;

      const res = await monalisaAgent.delete(`/api/templates/${templateId}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Template API', () => {
    it('should require authentication for all routes', async () => {
      const res = await request(app).get('/api/templates').query({ workspaceId: andyWorkspaceId });
      expect(res.status).toBe(401);
    });

    it('should reject empty template name', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const res = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: '',
        template_type: 'html',
        body: 'Content',
      });

      expect(res.status).toBe(400);
    });

    it('should reject missing required workspaceId', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const res = await agent.post('/api/templates').send({
        name: 'No Workspace',
        template_type: 'html',
        body: 'Content',
      });

      expect(res.status).toBe(400);
    });

    it('should reject missing required body field', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const res = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'No Body',
        template_type: 'html',
        subject: 'Missing body',
      });

      expect(res.status).toBe(400);
    });

    it('should support workspace isolation (Andy cannot see Monalisa templates)', async () => {
      const andyAgent = request.agent(app);
      await andyAgent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const monalisaAgent = request.agent(app);
      await monalisaAgent.post('/api/auth/login').send({
        email: 'monalisa@example.com',
        password: 'password123',
      });

      // Create template in Monalisa's workspace
      const monalisaRes = await monalisaAgent.post('/api/templates').send({
        workspaceId: monalisaWorkspaceId,
        name: 'Secret Template',
        template_type: 'html',
        body: 'Secret content',
      });

      const templateId = monalisaRes.body.data.id;

      // Try to access from Andy (different workspace)
      const res = await andyAgent.get(`/api/templates/${templateId}`);
      expect(res.status).toBe(403);
    });

    it('should list only templates from requested workspace', async () => {
      const andyAgent = request.agent(app);
      await andyAgent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const monalisaAgent = request.agent(app);
      await monalisaAgent.post('/api/auth/login').send({
        email: 'monalisa@example.com',
        password: 'password123',
      });

      // Create template in Andy's workspace
      await andyAgent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: "Andy's Template",
        template_type: 'html',
        body: 'Andy content',
      });

      // Create template in Monalisa's workspace
      await monalisaAgent.post('/api/templates').send({
        workspaceId: monalisaWorkspaceId,
        name: "Monalisa's Template",
        template_type: 'html',
        body: 'Monalisa content',
      });

      // Andy lists templates - should only see Andy's
      const res = await andyAgent.get('/api/templates').query({ workspaceId: andyWorkspaceId });

      expect(res.status).toBe(200);
      const names = res.body.data.map((t: any) => t.name);
      expect(names).toContain("Andy's Template");
      expect(names).not.toContain("Monalisa's Template");
    });

    it('should return 200 with default template_type when not provided', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const res = await agent.post('/api/templates').send({
        workspaceId: andyWorkspaceId,
        name: 'Default Type Template',
        body: 'Content without type',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.template_type).toBe('html'); // default
    });

    it('POST /api/templates/generate should be available (skip if no API key)', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'andy@example.com',
        password: 'password123',
      });

      const res = await agent.post('/api/templates/generate').send({
        workspaceId: andyWorkspaceId,
        name: 'Generated Template',
        templateType: 'html',
        goal: 'Welcome new users',
        audience: 'Business owners',
        tone: 'Professional',
        mustHaves: ['CTA button'],
      });

      // Either succeeds (if API key set) or returns error (if not)
      if (process.env.OPENAI_API_KEY) {
        expect([201, 200]).toContain(res.status);
        expect(res.body.data.name).toBe('Generated Template');
      } else {
        // Without API key, should return 500 or similar
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });
  });
});
