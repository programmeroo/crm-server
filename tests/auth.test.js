const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { closeDb } = require('../config/database');
const User = require('../models/User');
const Workspace = require('../models/Workspace');

const TEST_DB_PATH = path.resolve(process.env.DATABASE_PATH);

let app;

beforeAll(async () => {
  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  delete require.cache[require.resolve('../app')];
  app = require('../app');

  await User.create({
    username: 'authuser',
    password: 'authpass123',
    displayName: 'Auth User'
  });
});

afterAll(() => {
  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe('Auth Middleware', () => {
  test('GET / without auth redirects to /login', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('GET /contacts without auth redirects to /login', async () => {
    const res = await request(app).get('/contacts');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('GET /help without auth returns 200', async () => {
    const res = await request(app).get('/help');
    expect(res.status).toBe(200);
  });
});

describe('Login Flow', () => {
  test('POST /login with valid credentials redirects to /', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'authuser', password: 'authpass123' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('POST /login with invalid password redirects to /login', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'authuser', password: 'wrongpass' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('POST /login with missing fields redirects to /login', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username: '', password: '' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('POST /login with nonexistent user redirects to /login', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'nobody', password: 'authpass123' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});

describe('Authenticated Access', () => {
  let agent;

  beforeAll(async () => {
    const user = User.findByUsername('authuser');
    const ws = Workspace.create({ userId: user.id, name: 'Auth Workspace' });

    agent = request.agent(app);
    await agent
      .post('/login')
      .type('form')
      .send({ username: 'authuser', password: 'authpass123' });

    await agent.post(`/workspaces/${ws.id}/activate`);
  });

  test('GET / returns 200 when authenticated', async () => {
    const res = await agent.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Pi-CRM');
  });

  test('GET /contacts returns 200 when authenticated with workspace', async () => {
    const res = await agent.get('/contacts');
    expect(res.status).toBe(200);
  });

  test('GET /contacts without workspace redirects to /workspaces', async () => {
    // Use a fresh agent with auth but no workspace
    const noWsAgent = request.agent(app);
    await noWsAgent
      .post('/login')
      .type('form')
      .send({ username: 'authuser', password: 'authpass123' });

    const res = await noWsAgent.get('/contacts');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/workspaces');
  });

  test('GET /login redirects to / when authenticated', async () => {
    const res = await agent.get('/login');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('POST /logout redirects to /login', async () => {
    const res = await agent.post('/logout');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('After logout, GET / redirects to /login', async () => {
    const res = await agent.get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
