const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../app');
const { getDb, closeDb } = require('../config/database');

const TEST_DB_PATH = path.resolve(process.env.DATABASE_PATH);

beforeAll(() => {
  // Start fresh: delete the test database if it exists
  if (fs.existsSync(TEST_DB_PATH)) {
    closeDb();
    fs.unlinkSync(TEST_DB_PATH);
  }
  // Re-initialize by requiring app (initDb runs on import)
  // Force a fresh connection after deleting the file
  const { initDb } = require('../config/database');
  initDb();
});

afterAll(() => {
  closeDb();
  // Clean up test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

describe('Smoke Tests', () => {
  test('GET / returns 200 and contains Pi-CRM', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Pi-CRM');
  });

  test('GET /contacts returns 200', async () => {
    const res = await request(app).get('/contacts');
    expect(res.status).toBe(200);
  });

  test('POST /contacts/add creates a contact and redirects', async () => {
    const res = await request(app)
      .post('/contacts/add')
      .type('form')
      .send({ name: 'Test User', email: 'test@example.com' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/contacts');
  });

  test('GET /contacts shows the newly created contact', async () => {
    const res = await request(app).get('/contacts');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Test User');
  });

  test('POST /contacts/delete/:id removes the contact', async () => {
    // Find the contact we just created
    const db = getDb();
    const contact = db.prepare("SELECT id FROM contacts WHERE name = 'Test User'").get();

    const res = await request(app)
      .post(`/contacts/delete/${contact.id}`)
      .type('form')
      .send();

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/contacts');

    // Verify it's gone
    const check = await request(app).get('/contacts');
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
});
