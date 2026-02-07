const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { closeDb } = require('../config/database');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Contact = require('../models/Contact');

const TEST_DB_PATH = path.resolve(process.env.DATABASE_PATH);

let app;
let agentA; // logged in as userA, workspace A active
let agentB; // logged in as userB, workspace B active
let wsA, wsB;

beforeAll(async () => {
  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  delete require.cache[require.resolve('../app')];
  app = require('../app');

  // Create two users with workspaces
  const userA = await User.create({ username: 'contactUserA', password: 'passA', displayName: 'User A' });
  const userB = await User.create({ username: 'contactUserB', password: 'passB', displayName: 'User B' });

  wsA = Workspace.create({ userId: userA.id, name: 'Workspace A' });
  wsB = Workspace.create({ userId: userB.id, name: 'Workspace B' });

  // Log in and activate workspaces
  agentA = request.agent(app);
  await agentA.post('/login').type('form').send({ username: 'contactUserA', password: 'passA' });
  await agentA.post(`/workspaces/${wsA.id}/activate`);

  agentB = request.agent(app);
  await agentB.post('/login').type('form').send({ username: 'contactUserB', password: 'passB' });
  await agentB.post(`/workspaces/${wsB.id}/activate`);
});

afterAll(() => {
  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe('Contact CRUD', () => {
  test('GET /contacts returns 200 with empty list', async () => {
    const res = await agentA.get('/contacts');
    expect(res.status).toBe(200);
    expect(res.text).toContain('No contacts yet');
  });

  test('POST /contacts/add creates a contact and redirects', async () => {
    const res = await agentA
      .post('/contacts/add')
      .type('form')
      .send({ first_name: 'Alice', last_name: 'Smith', company: 'Acme Corp' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/contacts');
  });

  test('GET /contacts shows the created contact', async () => {
    const res = await agentA.get('/contacts');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Alice');
    expect(res.text).toContain('Smith');
    expect(res.text).toContain('Acme Corp');
  });

  test('POST /contacts/add with empty first_name redirects with error', async () => {
    const res = await agentA
      .post('/contacts/add')
      .type('form')
      .send({ first_name: '', last_name: 'NoFirst' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/contacts');
  });

  test('POST /contacts/add with first_name only succeeds', async () => {
    const res = await agentA
      .post('/contacts/add')
      .type('form')
      .send({ first_name: 'Bob' });
    expect(res.status).toBe(302);

    const list = await agentA.get('/contacts');
    expect(list.text).toContain('Bob');
  });

  test('GET /contacts/edit/:id shows edit form', async () => {
    const contacts = Contact.findByWorkspaceId(wsA.id);
    const alice = contacts.find(c => c.first_name === 'Alice');

    const res = await agentA.get(`/contacts/edit/${alice.id}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Edit Contact');
    expect(res.text).toContain('Alice');
    expect(res.text).toContain('Smith');
  });

  test('POST /contacts/update/:id updates the contact', async () => {
    const contacts = Contact.findByWorkspaceId(wsA.id);
    const alice = contacts.find(c => c.first_name === 'Alice');

    const res = await agentA
      .post(`/contacts/update/${alice.id}`)
      .type('form')
      .send({ first_name: 'Alice', last_name: 'Johnson', company: 'NewCo', birthday: '1990-05-15', notes: 'Updated' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/contacts');

    const updated = Contact.findById(alice.id);
    expect(updated.last_name).toBe('Johnson');
    expect(updated.company).toBe('NewCo');
    expect(updated.birthday).toBe('1990-05-15');
    expect(updated.notes).toBe('Updated');
  });

  test('POST /contacts/update/:id with empty first_name redirects back', async () => {
    const contacts = Contact.findByWorkspaceId(wsA.id);
    const alice = contacts.find(c => c.first_name === 'Alice');

    const res = await agentA
      .post(`/contacts/update/${alice.id}`)
      .type('form')
      .send({ first_name: '', last_name: 'Bad' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/contacts/edit/${alice.id}`);

    // Name should be unchanged
    const unchanged = Contact.findById(alice.id);
    expect(unchanged.first_name).toBe('Alice');
  });

  test('POST /contacts/delete/:id removes the contact', async () => {
    const contacts = Contact.findByWorkspaceId(wsA.id);
    const bob = contacts.find(c => c.first_name === 'Bob');

    const res = await agentA
      .post(`/contacts/delete/${bob.id}`)
      .type('form')
      .send();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/contacts');

    const deleted = Contact.findById(bob.id);
    expect(deleted).toBeNull();
  });
});

describe('Contact Workspace Isolation', () => {
  test('User B cannot see User A contacts', async () => {
    const res = await agentB.get('/contacts');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Alice');
    expect(res.text).toContain('No contacts yet');
  });

  test('User B creates own contact', async () => {
    const res = await agentB
      .post('/contacts/add')
      .type('form')
      .send({ first_name: 'Charlie', last_name: 'Brown', company: 'B Corp' });
    expect(res.status).toBe(302);

    const list = await agentB.get('/contacts');
    expect(list.text).toContain('Charlie');
    expect(list.text).not.toContain('Alice');
  });

  test('User A cannot edit User B contact', async () => {
    const bContacts = Contact.findByWorkspaceId(wsB.id);
    const charlie = bContacts.find(c => c.first_name === 'Charlie');

    const res = await agentA.get(`/contacts/edit/${charlie.id}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/contacts');
  });

  test('User A cannot update User B contact', async () => {
    const bContacts = Contact.findByWorkspaceId(wsB.id);
    const charlie = bContacts.find(c => c.first_name === 'Charlie');

    const res = await agentA
      .post(`/contacts/update/${charlie.id}`)
      .type('form')
      .send({ first_name: 'Hacked' });
    expect(res.status).toBe(302);

    const unchanged = Contact.findById(charlie.id);
    expect(unchanged.first_name).toBe('Charlie');
  });

  test('User A cannot delete User B contact', async () => {
    const bContacts = Contact.findByWorkspaceId(wsB.id);
    const charlie = bContacts.find(c => c.first_name === 'Charlie');

    const res = await agentA
      .post(`/contacts/delete/${charlie.id}`)
      .type('form')
      .send();
    expect(res.status).toBe(302);

    const stillExists = Contact.findById(charlie.id);
    expect(stillExists).not.toBeNull();
  });
});

describe('Contact Search', () => {
  beforeAll(() => {
    // Add more contacts to User A's workspace for search testing
    Contact.create({ workspaceId: wsA.id, firstName: 'David', lastName: 'Lee', company: 'Acme Corp' });
    Contact.create({ workspaceId: wsA.id, firstName: 'Eve', lastName: 'Adams', company: 'Beta Inc' });
  });

  test('GET /contacts?search= filters by first name', async () => {
    const res = await agentA.get('/contacts?search=David');
    expect(res.status).toBe(200);
    expect(res.text).toContain('David');
    expect(res.text).not.toContain('Eve');
  });

  test('GET /contacts?search= filters by last name', async () => {
    const res = await agentA.get('/contacts?search=Adams');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Eve');
    expect(res.text).not.toContain('David');
  });

  test('GET /contacts?search= filters by company', async () => {
    const res = await agentA.get('/contacts?search=Beta');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Eve');
    expect(res.text).not.toContain('David');
  });

  test('GET /contacts?search= with no results shows empty message', async () => {
    const res = await agentA.get('/contacts?search=Zzzzz');
    expect(res.status).toBe(200);
    expect(res.text).toContain('No contacts match');
  });

  test('Dashboard shows correct contact count for workspace', async () => {
    const res = await agentA.get('/');
    expect(res.status).toBe(200);
    // User A should have Alice + David + Eve = 3 contacts
    expect(res.text).toContain('3');
  });
});

describe('Contact Model', () => {
  test('Contact.count returns correct count per workspace', () => {
    const countA = Contact.count(wsA.id);
    const countB = Contact.count(wsB.id);
    expect(countA).toBe(3); // Alice, David, Eve
    expect(countB).toBe(1); // Charlie
  });

  test('Contact.findByWorkspaceId with sort option', () => {
    const contacts = Contact.findByWorkspaceId(wsA.id, { sortBy: 'last_name' });
    // Adams, Johnson, Lee
    expect(contacts[0].last_name).toBe('Adams');
    expect(contacts[contacts.length - 1].last_name).toBe('Lee');
  });

  test('Contact.findByWorkspaceId with limit and offset', () => {
    const page1 = Contact.findByWorkspaceId(wsA.id, { limit: 2 });
    expect(page1).toHaveLength(2);

    const page2 = Contact.findByWorkspaceId(wsA.id, { limit: 2, offset: 2 });
    expect(page2).toHaveLength(1);
  });
});
