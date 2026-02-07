const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { closeDb } = require('../config/database');
const User = require('../models/User');
const Workspace = require('../models/Workspace');

const TEST_DB_PATH = path.resolve(process.env.DATABASE_PATH);

let app;
let agent;

beforeAll(async () => {
  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  delete require.cache[require.resolve('../app')];
  app = require('../app');

  // Create a test user, workspace, and log in
  const user = await User.create({
    username: 'smokeuser',
    password: 'smokepass',
    displayName: 'Smoke User'
  });

  const ws = Workspace.create({ userId: user.id, name: 'Smoke Workspace' });

  agent = request.agent(app);
  await agent
    .post('/login')
    .type('form')
    .send({ username: 'smokeuser', password: 'smokepass' });

  // Activate the workspace
  await agent.post(`/workspaces/${ws.id}/activate`);
});

afterAll(() => {
  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe('Smoke Tests', () => {
  test('GET / returns 200 and contains Pi-CRM', async () => {
    const res = await agent.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Pi-CRM');
  });

  test('GET /contacts returns 200', async () => {
    const res = await agent.get('/contacts');
    expect(res.status).toBe(200);
  });

  test('POST /contacts/add creates a contact and redirects', async () => {
    const res = await agent
      .post('/contacts/add')
      .type('form')
      .send({ name: 'Test User', email: 'test@example.com' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/contacts');
  });

  test('GET /contacts shows the newly created contact', async () => {
    const res = await agent.get('/contacts');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Test User');
  });

  test('POST /contacts/delete/:id removes the contact', async () => {
    const { getDb } = require('../config/database');
    const db = getDb();
    const contact = db.prepare("SELECT id FROM contacts WHERE name = 'Test User'").get();

    const res = await agent
      .post(`/contacts/delete/${contact.id}`)
      .type('form')
      .send();

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/contacts');

    const check = await agent.get('/contacts');
    expect(check.text).not.toContain('Test User');
  });

  test('GET /help returns 200', async () => {
    const res = await request(app).get('/help');
    expect(res.status).toBe(200);
  });

  test('GET /feedback returns 200', async () => {
    const res = await request(app).get('/feedback');
    expect(res.status).toBe(200);
  });

  test('GET /login returns 200 for unauthenticated user', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Log In');
  });
});
