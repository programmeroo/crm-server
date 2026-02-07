const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { closeDb } = require('../config/database');
const User = require('../models/User');
const Workspace = require('../models/Workspace');

const TEST_DB_PATH = path.resolve(process.env.DATABASE_PATH);

let app;
let agentA; // logged in as userA
let agentB; // logged in as userB

beforeAll(async () => {
  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  delete require.cache[require.resolve('../app')];
  app = require('../app');

  // Create two users
  await User.create({ username: 'wsUserA', password: 'passA', displayName: 'User A' });
  await User.create({ username: 'wsUserB', password: 'passB', displayName: 'User B' });

  // Log in both agents
  agentA = request.agent(app);
  await agentA.post('/login').type('form').send({ username: 'wsUserA', password: 'passA' });

  agentB = request.agent(app);
  await agentB.post('/login').type('form').send({ username: 'wsUserB', password: 'passB' });
});

afterAll(() => {
  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe('Workspace CRUD', () => {
  test('GET /workspaces returns 200 with empty list', async () => {
    const res = await agentA.get('/workspaces');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Workspaces');
  });

  test('GET /workspaces/new returns 200', async () => {
    const res = await agentA.get('/workspaces/new');
    expect(res.status).toBe(200);
    expect(res.text).toContain('New Workspace');
  });

  test('POST /workspaces creates a workspace and redirects', async () => {
    const res = await agentA
      .post('/workspaces')
      .type('form')
      .send({ name: 'My Workspace', description: 'Test workspace' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/workspaces');
  });

  test('GET /workspaces shows the created workspace', async () => {
    const res = await agentA.get('/workspaces');
    expect(res.status).toBe(200);
    expect(res.text).toContain('My Workspace');
  });

  test('POST /workspaces with empty name redirects back with error', async () => {
    const res = await agentA
      .post('/workspaces')
      .type('form')
      .send({ name: '', description: '' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/workspaces/new');
  });

  test('GET /workspaces/:id/edit shows edit form', async () => {
    const userA = User.findByUsername('wsUserA');
    const workspaces = Workspace.findByUserId(userA.id);
    const ws = workspaces[0];

    const res = await agentA.get(`/workspaces/${ws.id}/edit`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Edit Workspace');
    expect(res.text).toContain('My Workspace');
  });

  test('POST /workspaces/:id updates the workspace', async () => {
    const userA = User.findByUsername('wsUserA');
    const workspaces = Workspace.findByUserId(userA.id);
    const ws = workspaces[0];

    const res = await agentA
      .post(`/workspaces/${ws.id}`)
      .type('form')
      .send({ name: 'Renamed Workspace', description: 'Updated desc' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/workspaces');

    const updated = Workspace.findById(ws.id);
    expect(updated.name).toBe('Renamed Workspace');
    expect(updated.description).toBe('Updated desc');
  });

  test('POST /workspaces/:id/delete removes the workspace', async () => {
    // Create a workspace to delete
    const userA = User.findByUsername('wsUserA');
    Workspace.create({ userId: userA.id, name: 'To Delete' });
    const workspaces = Workspace.findByUserId(userA.id);
    const toDelete = workspaces.find(w => w.name === 'To Delete');

    const res = await agentA
      .post(`/workspaces/${toDelete.id}/delete`)
      .type('form')
      .send();
    expect(res.status).toBe(302);

    const deleted = Workspace.findById(toDelete.id);
    expect(deleted).toBeNull();
  });
});

describe('Workspace Isolation', () => {
  test('User B cannot see User A workspaces', async () => {
    const res = await agentB.get('/workspaces');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Renamed Workspace');
  });

  test('User B creates own workspace', async () => {
    const res = await agentB
      .post('/workspaces')
      .type('form')
      .send({ name: 'B Workspace' });
    expect(res.status).toBe(302);

    const listRes = await agentB.get('/workspaces');
    expect(listRes.text).toContain('B Workspace');
    expect(listRes.text).not.toContain('Renamed Workspace');
  });

  test('User A cannot edit User B workspace', async () => {
    const userB = User.findByUsername('wsUserB');
    const bWorkspaces = Workspace.findByUserId(userB.id);
    const bWs = bWorkspaces[0];

    const res = await agentA.get(`/workspaces/${bWs.id}/edit`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/workspaces');
  });

  test('User A cannot update User B workspace', async () => {
    const userB = User.findByUsername('wsUserB');
    const bWorkspaces = Workspace.findByUserId(userB.id);
    const bWs = bWorkspaces[0];

    const res = await agentA
      .post(`/workspaces/${bWs.id}`)
      .type('form')
      .send({ name: 'Hacked' });
    expect(res.status).toBe(302);

    const unchanged = Workspace.findById(bWs.id);
    expect(unchanged.name).toBe('B Workspace');
  });

  test('User A cannot delete User B workspace', async () => {
    const userB = User.findByUsername('wsUserB');
    const bWorkspaces = Workspace.findByUserId(userB.id);
    const bWs = bWorkspaces[0];

    const res = await agentA
      .post(`/workspaces/${bWs.id}/delete`)
      .type('form')
      .send();
    expect(res.status).toBe(302);

    const stillExists = Workspace.findById(bWs.id);
    expect(stillExists).not.toBeNull();
  });
});

describe('Workspace Activation & Scoping', () => {
  test('POST /workspaces/:id/activate sets active workspace', async () => {
    const userA = User.findByUsername('wsUserA');
    const workspaces = Workspace.findByUserId(userA.id);
    const ws = workspaces[0];

    const res = await agentA.post(`/workspaces/${ws.id}/activate`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');

    // Dashboard should now show workspace name in switcher
    const dashboard = await agentA.get('/');
    expect(dashboard.status).toBe(200);
    expect(dashboard.text).toContain(ws.name);
  });

  test('User A cannot activate User B workspace', async () => {
    const userB = User.findByUsername('wsUserB');
    const bWorkspaces = Workspace.findByUserId(userB.id);
    const bWs = bWorkspaces[0];

    const res = await agentA.post(`/workspaces/${bWs.id}/activate`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/workspaces');
  });

  test('GET /contacts without active workspace redirects to /workspaces', async () => {
    // Fresh agent with no workspace activated
    const freshAgent = request.agent(app);
    await freshAgent.post('/login').type('form').send({ username: 'wsUserA', password: 'passA' });

    const res = await freshAgent.get('/contacts');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/workspaces');
  });

  test('GET /contacts with active workspace returns 200', async () => {
    // agentA already has an active workspace from earlier test
    const res = await agentA.get('/contacts');
    expect(res.status).toBe(200);
  });

  test('Switching workspaces updates context', async () => {
    const userA = User.findByUsername('wsUserA');
    // Create a second workspace to switch to
    const ws2 = Workspace.create({ userId: userA.id, name: 'Second WS' });

    await agentA.post(`/workspaces/${ws2.id}/activate`);

    const dashboard = await agentA.get('/');
    expect(dashboard.status).toBe(200);
    expect(dashboard.text).toContain('Second WS');
  });

  test('Workspace list in switcher only shows own workspaces', async () => {
    const dashboard = await agentB.get('/workspaces');
    expect(dashboard.text).toContain('B Workspace');
    expect(dashboard.text).not.toContain('Renamed Workspace');
    expect(dashboard.text).not.toContain('Second WS');
  });
});
