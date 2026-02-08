import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApp } from '../app';
import { createDataSource, initializeDatabase } from '../config/database';
import { AuthService } from '../services/AuthService';
import { User } from '../entities/User.entity';

describe('API Keys', () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;
  let authService: AuthService;
  let testUser: User;

  beforeAll(async () => {
    dataSource = createDataSource({ database: ':memory:', synchronize: true });
    await initializeDatabase(dataSource);
    app = createApp(dataSource);
    authService = new AuthService(dataSource);
    testUser = await authService.register('keytest@example.com', 'password123', 'Key Tester');
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('AuthService - API Keys', () => {
    it('should generate an API key', async () => {
      const { apiKey, rawKey } = await authService.generateApiKey(
        testUser.id, 'Test key', ['read:contacts']
      );

      expect(apiKey.id).toBeDefined();
      expect(rawKey).toBeDefined();
      expect(apiKey.description).toBe('Test key');
      expect(JSON.parse(apiKey.scopes)).toEqual(['read:contacts']);
      expect(apiKey.is_active).toBe(1);
    });

    it('should validate a valid key', async () => {
      const { rawKey } = await authService.generateApiKey(
        testUser.id, 'Valid key', ['read:contacts', 'write:contacts']
      );

      const result = await authService.validateApiKey(rawKey);
      expect(result.user.email).toBe('keytest@example.com');
      expect(result.scopes).toEqual(['read:contacts', 'write:contacts']);
    });

    it('should reject an invalid key', async () => {
      await expect(
        authService.validateApiKey('not-a-real-key')
      ).rejects.toThrow('Invalid API key');
    });

    it('should reject a revoked key', async () => {
      const { apiKey, rawKey } = await authService.generateApiKey(
        testUser.id, 'Revoke me', ['read:contacts']
      );

      await authService.revokeApiKey(apiKey.id, testUser.id);

      await expect(
        authService.validateApiKey(rawKey)
      ).rejects.toThrow('API key has been revoked');
    });

    it('should reject an expired key', async () => {
      const { apiKey, rawKey } = await authService.generateApiKey(
        testUser.id, 'Expired key', ['read:contacts'], 1
      );

      // Manually set expires_at to the past
      await dataSource.query(
        `UPDATE api_keys SET expires_at = '2020-01-01T00:00:00.000Z' WHERE id = ?`,
        [apiKey.id]
      );

      await expect(
        authService.validateApiKey(rawKey)
      ).rejects.toThrow('API key has expired');
    });
  });

  describe('API Key Management Routes', () => {
    let agent: ReturnType<typeof request.agent>;

    beforeAll(async () => {
      agent = request.agent(app);
      await agent
        .post('/api/auth/login')
        .send({ email: 'keytest@example.com', password: 'password123' });
    });

    it('POST /api/auth/keys should create a key (requires login)', async () => {
      const res = await agent
        .post('/api/auth/keys')
        .send({ description: 'My API key', scopes: ['read:contacts'] });

      expect(res.status).toBe(201);
      expect(res.body.data.key).toBeDefined();
      expect(res.body.data.description).toBe('My API key');
      expect(res.body.data.scopes).toEqual(['read:contacts']);
    });

    it('POST /api/auth/keys should reject without login', async () => {
      const res = await request(app)
        .post('/api/auth/keys')
        .send({ description: 'No auth', scopes: ['read:contacts'] });

      expect(res.status).toBe(401);
    });

    it('POST /api/auth/keys should validate input', async () => {
      const res = await agent
        .post('/api/auth/keys')
        .send({ description: 'No scopes' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/auth/keys should list keys', async () => {
      const res = await agent.get('/api/auth/keys');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('DELETE /api/auth/keys/:id should revoke a key', async () => {
      const createRes = await agent
        .post('/api/auth/keys')
        .send({ description: 'To revoke', scopes: ['read:contacts'] });

      const res = await agent.delete(`/api/auth/keys/${createRes.body.data.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('API key revoked');
    });
  });

  describe('API Key Middleware', () => {
    let validKey: string;

    beforeAll(async () => {
      const { rawKey } = await authService.generateApiKey(
        testUser.id, 'Middleware test', ['read:contacts']
      );
      validKey = rawKey;
    });

    it('should authenticate with valid X-Api-Key header', async () => {
      const res = await request(app)
        .get('/api/protected')
        .set('X-Api-Key', validKey);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toBe('keytest@example.com');
      expect(res.body.data.scopes).toEqual(['read:contacts']);
    });

    it('should reject with invalid X-Api-Key header', async () => {
      const res = await request(app)
        .get('/api/protected')
        .set('X-Api-Key', 'bad-key');

      expect(res.status).toBe(401);
    });

    it('should reject without any auth', async () => {
      const res = await request(app).get('/api/protected');

      expect(res.status).toBe(401);
    });
  });
});
