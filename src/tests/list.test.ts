import request, { Test } from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { DataSource } from 'typeorm';
import { createApp } from '../app';
import { createDataSource, initializeDatabase } from '../config/database';
import { AuthService } from '../services/AuthService';
import { WorkspaceService } from '../services/WorkspaceService';
import { ContactService } from '../services/ContactService';
import { ListService } from '../services/ListService';

describe('Contact Lists', () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;
  let authService: AuthService;
  let workspaceService: WorkspaceService;
  let contactService: ContactService;
  let listService: ListService;
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
    listService = new ListService(dataSource);

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

  describe('ListService', () => {
    it('should create a list', async () => {
      const list = await listService.createList(andyWsId, 'Leads');
      expect(list.id).toBeDefined();
      expect(list.workspace_id).toBe(andyWsId);
      expect(list.name).toBe('Leads');
      expect(list.is_primary).toBe(0);
      expect(list.created_at).toBeDefined();
    });

    it('should create a primary list', async () => {
      const list = await listService.createList(andyWsId, 'Prospects', true);
      expect(list.is_primary).toBe(1);
    });

    it('should reject duplicate list name in same workspace', async () => {
      await expect(listService.createList(andyWsId, 'Leads'))
        .rejects.toThrow('A list with this name already exists in this workspace');
    });

    it('should allow same list name in different workspaces', async () => {
      const list = await listService.createList(monalisaWsId, 'Leads');
      expect(list.name).toBe('Leads');
    });

    it('should list all lists in a workspace', async () => {
      const lists = await listService.getListsByWorkspace(andyWsId);
      expect(lists.length).toBe(2);
      expect(lists.map(l => l.name).sort()).toEqual(['Leads', 'Prospects']);
    });

    it('should assign a contact to a list', async () => {
      const contact = await contactService.create(andyWsId, {
        firstName: 'Alice',
        primaryEmail: 'alice@example.com',
      });
      const lists = await listService.getListsByWorkspace(andyWsId);
      const leadsList = lists.find(l => l.name === 'Leads')!;

      const assignment = await listService.assignToContact(contact.id, leadsList.id);
      expect(assignment.contact_id).toBe(contact.id);
      expect(assignment.list_id).toBe(leadsList.id);
      expect(assignment.assigned_at).toBeDefined();
    });

    it('should get lists for a contact', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const alice = contacts.find(c => c.first_name === 'Alice')!;

      const lists = await listService.getListsForContact(alice.id);
      expect(lists.length).toBe(1);
      expect(lists[0].name).toBe('Leads');
    });

    it('should enforce one primary list per contact', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const alice = contacts.find(c => c.first_name === 'Alice')!;
      const lists = await listService.getListsByWorkspace(andyWsId);
      const prospectsList = lists.find(l => l.name === 'Prospects')!;

      // Create another primary list
      const vipList = await listService.createList(andyWsId, 'VIP', true);

      // Assign Alice to Prospects (primary) - should work
      await listService.assignToContact(alice.id, prospectsList.id);

      // Alice should now be in Leads (non-primary) and Prospects (primary)
      let aliceLists = await listService.getListsForContact(alice.id);
      expect(aliceLists.length).toBe(2);

      // Assign Alice to VIP (also primary) - should remove from Prospects
      await listService.assignToContact(alice.id, vipList.id);

      aliceLists = await listService.getListsForContact(alice.id);
      const listNames = aliceLists.map(l => l.name).sort();
      expect(listNames).toEqual(['Leads', 'VIP']);
      expect(aliceLists.find(l => l.name === 'Prospects')).toBeUndefined();
    });

    it('should reject duplicate assignment', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const alice = contacts.find(c => c.first_name === 'Alice')!;
      const lists = await listService.getListsByWorkspace(andyWsId);
      const leadsList = lists.find(l => l.name === 'Leads')!;

      await expect(listService.assignToContact(alice.id, leadsList.id))
        .rejects.toThrow('Contact is already assigned to this list');
    });

    it('should reject assignment across workspaces', async () => {
      const contact = await contactService.create(andyWsId, {
        firstName: 'Bob',
        primaryEmail: 'bob@example.com',
      });
      const monalisaLists = await listService.getListsByWorkspace(monalisaWsId);
      const monalisaLeads = monalisaLists.find(l => l.name === 'Leads')!;

      await expect(listService.assignToContact(contact.id, monalisaLeads.id))
        .rejects.toThrow('Contact and list must belong to the same workspace');
    });

    it('should remove an assignment', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const alice = contacts.find(c => c.first_name === 'Alice')!;
      const lists = await listService.getListsByWorkspace(andyWsId);
      const leadsList = lists.find(l => l.name === 'Leads')!;

      await listService.removeAssignment(alice.id, leadsList.id);

      const aliceLists = await listService.getListsForContact(alice.id);
      expect(aliceLists.find(l => l.name === 'Leads')).toBeUndefined();
    });

    it('should reject removing non-existent assignment', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const alice = contacts.find(c => c.first_name === 'Alice')!;
      const lists = await listService.getListsByWorkspace(andyWsId);
      const leadsList = lists.find(l => l.name === 'Leads')!;

      await expect(listService.removeAssignment(alice.id, leadsList.id))
        .rejects.toThrow('Assignment not found');
    });

    it('should delete a list', async () => {
      const list = await listService.createList(andyWsId, 'ToDelete');
      await listService.deleteList(list.id, andyWsId);
      const found = await listService.findById(list.id);
      expect(found).toBeNull();
    });

    it('should reject delete for wrong workspace', async () => {
      const lists = await listService.getListsByWorkspace(andyWsId);
      await expect(listService.deleteList(lists[0].id, monalisaWsId))
        .rejects.toThrow('List does not belong to this workspace');
    });
  });

  describe('List API', () => {
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

    it('POST /api/lists should create a list', async () => {
      const res = await andyAgent
        .post('/api/lists')
        .send({ workspaceId: andyWsId, name: 'API List' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('API List');
      expect(res.body.error).toBeNull();
    });

    it('POST /api/lists should reject for other users workspace', async () => {
      const res = await monalisaAgent
        .post('/api/lists')
        .send({ workspaceId: andyWsId, name: 'Intruder List' });
      expect(res.status).toBe(403);
    });

    it('POST /api/lists/assign should assign contact to list', async () => {
      const contact = await contactService.create(andyWsId, {
        firstName: 'APIAssign',
        primaryEmail: 'apiassign@example.com',
      });
      const lists = await listService.getListsByWorkspace(andyWsId);
      const apiList = lists.find(l => l.name === 'API List')!;

      const res = await andyAgent
        .post('/api/lists/assign')
        .send({ contactId: contact.id, listId: apiList.id });
      expect(res.status).toBe(201);
      expect(res.body.data.contact_id).toBe(contact.id);
      expect(res.body.data.list_id).toBe(apiList.id);
    });

    it('POST /api/lists/assign should reject for other users workspace', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const lists = await listService.getListsByWorkspace(andyWsId);

      const res = await monalisaAgent
        .post('/api/lists/assign')
        .send({ contactId: contacts[0].id, listId: lists[0].id });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/lists/assign should remove assignment', async () => {
      const contacts = await contactService.findByWorkspace(andyWsId);
      const apiAssign = contacts.find(c => c.first_name === 'APIAssign')!;
      const lists = await listService.getListsByWorkspace(andyWsId);
      const apiList = lists.find(l => l.name === 'API List')!;

      const res = await andyAgent
        .delete('/api/lists/assign')
        .send({ contactId: apiAssign.id, listId: apiList.id });
      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Assignment removed');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/lists')
        .send({ workspaceId: andyWsId, name: 'No Auth' });
      expect(res.status).toBe(401);
    });
  });
});
