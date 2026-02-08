import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApp } from '../app';
import { createDataSource, initializeDatabase } from '../config/database';
import { AuthService } from '../services/AuthService';

describe('Auth', () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;
  let authService: AuthService;

  beforeAll(async () => {
    dataSource = createDataSource({ database: ':memory:', synchronize: true });
    await initializeDatabase(dataSource);
    app = createApp(dataSource);
    authService = new AuthService(dataSource);
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('AuthService', () => {
    it('should register a new user with hashed password', async () => {
      const user = await authService.register('test@example.com', 'password123', 'Test User');

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.password_hash).not.toBe('password123');
      expect(user.name).toBe('Test User');
    });

    it('should reject duplicate email registration', async () => {
      await expect(
        authService.register('test@example.com', 'password123')
      ).rejects.toThrow('A user with this email already exists');
    });

    it('should login with correct credentials', async () => {
      const user = await authService.login('test@example.com', 'password123');
      expect(user.email).toBe('test@example.com');
    });

    it('should reject login with wrong password', async () => {
      await expect(
        authService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      await expect(
        authService.login('nobody@example.com', 'password123')
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('Auth API', () => {
    beforeAll(async () => {
      try {
        await authService.register('api@example.com', 'password123', 'API User');
      } catch { /* already exists */ }
    });

    it('POST /api/auth/login should succeed with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'api@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('api@example.com');
      expect(res.body.error).toBeNull();
    });

    it('POST /api/auth/login should fail with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'api@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('POST /api/auth/login should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/auth/login should set session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'api@example.com', password: 'password123' });

      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('POST /api/auth/logout should clear session', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/auth/login')
        .send({ email: 'api@example.com', password: 'password123' });

      const res = await agent.post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Logged out');
    });

    it('GET /api/auth/me should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/me should return user for authenticated requests', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/auth/login')
        .send({ email: 'api@example.com', password: 'password123' });

      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('api@example.com');
      expect(res.body.data.name).toBe('API User');
    });
  });
});
