import request, { Test } from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { DataSource } from 'typeorm';
import { createApp } from '../app';
import { createDataSource, initializeDatabase } from '../config/database';
import { AuthService } from '../services/AuthService';
import { WorkspaceService } from '../services/WorkspaceService';
import { ContactService } from '../services/ContactService';

describe('Base Contacts', () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;
  let authService: AuthService;
  let workspaceService: WorkspaceService;
  let contactService: ContactService;
  let andyId: string;
  let monalisaId: string;
  let andyWsId: string;
  let monalisaWsId: string;

  beforeAll(async () => {
    dataSource = createDataSource({ database: ':memory:', synchronize: true });
    await initializeDatabase(dataSource);
    app = createApp(dataSource);
    authService = new AuthService(dataSource);
    workspaceService = new WorkspaceService(dataSource);
    contactService = new ContactService(dataSource);

    const andy = await authService.register('andy@example.com', 'password123', 'Andy');
    andyId = andy.id;
    const monalisa = await authService.register('monalisa@example.com', 'password123', 'Monalisa');
    monalisaId = monalisa.id;

    const andyWs = await workspaceService.create(andyId, 'Andy CRM');
    andyWsId = andyWs.id;
    const monalisaWs = await workspaceService.create(monalisaId, 'Monalisa CRM');
    monalisaWsId = monalisaWs.id;
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('ContactService', () => {
    it('should create a contact with all fields', async () => {
      const contact = await contactService.create(andyWsId, {
        firstName: 'John',
        lastName: 'Doe',
        primaryEmail: 'john@example.com',
        primaryPhone: '555-0100',
        company: 'Acme Inc',
      });

      expect(contact.id).toBeDefined();
      expect(contact.workspace_id).toBe(andyWsId);
      expect(contact.first_name).toBe('John');
      expect(contact.last_name).toBe('Doe');
      expect(contact.primary_email).toBe('john@example.com');
      expect(contact.primary_phone).toBe('555-0100');
      expect(contact.company).toBe('Acme Inc');
      expect(contact.created_on).toBeDefined();
    });

    it('should create a contact with only some fields', async () => {
      const contact = await contactService.create(andyWsId, {
        firstName: 'Jane',
      });

      expect(contact.first_name).toBe('Jane');
      expect(contact.primary_email).toBeNull();
      expect(contact.primary_phone).toBeNull();
    });

    it('should reject duplicate email in same workspace', async () => {
      await expect(contactService.create(andyWsId, {
        firstName: 'Duplicate',
        primaryEmail: 'john@example.com',
      })).rejects.toThrow('A contact with this email already exists');
    });

    it('should reject duplicate phone in same workspace', async () => {
      await expect(contactService.create(andyWsId, {
        firstName: 'Duplicate',
        primaryPhone: '555-0100',
      })).rejects.toThrow('A contact with this phone already exists');
    });

    it('should allow same email in different workspaces', async () => {
      const contact = await contactService.create(monalisaWsId, {
        firstName: 'John Clone',
        primaryEmail: 'john@example.com',
      });
      expect(contact.primary_email).toBe('john@example.com');
    });

    it('should find contact by id', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const found = await contactService.findById(contacts[0].id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(contacts[0].id);
    });

    it('should list contacts by workspace', async () => {
      const andyContacts = await contactService.findByWorkspace(andyWsId);
      const monalisaContacts = await contactService.findByWorkspace(monalisaWsId);
      expect(andyContacts.length).toBe(2);
      expect(monalisaContacts.length).toBe(1);
    });

    it('should update a contact', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const contact = contacts.find(c => c.first_name === 'John')!;
      const updated = await contactService.update(contact.id, andyWsId, {
        company: 'New Corp',
      });
      expect(updated.company).toBe('New Corp');
      expect(updated.first_name).toBe('John');
    });

    it('should reject update with duplicate email', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const jane = contacts.find(c => c.first_name === 'Jane')!;
      await expect(contactService.update(jane.id, andyWsId, {
        primaryEmail: 'john@example.com',
      })).rejects.toThrow('A contact with this email already exists');
    });

    it('should reject update for wrong workspace', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      await expect(contactService.update(contacts[0].id, monalisaWsId, {
        firstName: 'Hacked',
      })).rejects.toThrow('Contact does not belong to this workspace');
    });

    it('should delete a contact', async () => {
      const contact = await contactService.create(andyWsId, {
        firstName: 'ToDelete',
      });
      await contactService.delete(contact.id, andyWsId);
      const found = await contactService.findById(contact.id);
      expect(found).toBeNull();
    });

    it('should reject delete for wrong workspace', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      await expect(contactService.delete(contacts[0].id, monalisaWsId))
        .rejects.toThrow('Contact does not belong to this workspace');
    });
  });

  describe('Contact API', () => {
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

    it('POST /api/contacts should create a contact', async () => {
      const res = await andyAgent
        .post('/api/contacts')
        .send({
          workspaceId: andyWsId,
          firstName: 'API',
          lastName: 'Contact',
          primaryEmail: 'api@example.com',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.first_name).toBe('API');
      expect(res.body.error).toBeNull();
    });

    it('POST /api/contacts should reject for other users workspace', async () => {
      const res = await monalisaAgent
        .post('/api/contacts')
        .send({
          workspaceId: andyWsId,
          firstName: 'Intruder',
        });
      expect(res.status).toBe(403);
    });

    it('GET /api/contacts/workspace/:id should list contacts', async () => {
      const res = await andyAgent.get(`/api/contacts/workspace/${andyWsId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/contacts/:id should get a single contact', async () => {
      const list = await andyAgent.get(`/api/contacts/workspace/${andyWsId}`);
      const contactId = list.body.data[0].id;

      const res = await andyAgent.get(`/api/contacts/${contactId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(contactId);
    });

    it('GET /api/contacts/:id should reject for other users contact', async () => {
      const list = await andyAgent.get(`/api/contacts/workspace/${andyWsId}`);
      const contactId = list.body.data[0].id;

      const res = await monalisaAgent.get(`/api/contacts/${contactId}`);
      expect(res.status).toBe(403);
    });

    it('PUT /api/contacts/:id should update a contact', async () => {
      const list = await andyAgent.get(`/api/contacts/workspace/${andyWsId}`);
      const contactId = list.body.data[0].id;

      const res = await andyAgent
        .put(`/api/contacts/${contactId}`)
        .send({ company: 'Updated Corp' });
      expect(res.status).toBe(200);
      expect(res.body.data.company).toBe('Updated Corp');
    });

    it('DELETE /api/contacts/:id should delete a contact', async () => {
      const createRes = await andyAgent
        .post('/api/contacts')
        .send({ workspaceId: andyWsId, firstName: 'DeleteMe' });
      const contactId = createRes.body.data.id;

      const res = await andyAgent.delete(`/api/contacts/${contactId}`);
      expect(res.status).toBe(200);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get(`/api/contacts/workspace/${andyWsId}`);
      expect(res.status).toBe(401);
    });
  });
});
