import { DataSource, Repository, In } from 'typeorm';
import { ContactList } from '../entities/ContactList.entity';
import { ContactListAssignment } from '../entities/ContactListAssignment.entity';
import { BaseContact } from '../entities/BaseContact.entity';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';

export class ListService {
  private listRepo: Repository<ContactList>;
  private assignmentRepo: Repository<ContactListAssignment>;
  private contactRepo: Repository<BaseContact>;

  constructor(private dataSource: DataSource) {
    this.listRepo = this.dataSource.getRepository(ContactList);
    this.assignmentRepo = this.dataSource.getRepository(ContactListAssignment);
    this.contactRepo = this.dataSource.getRepository(BaseContact);
  }

  async createList(workspaceId: number, name: string, isPrimary: boolean = false): Promise<ContactList> {
    const existing = await this.listRepo.findOne({
      where: { workspace_id: workspaceId, name },
    });
    if (existing) {
      throw new AppError('DUPLICATE', 'A list with this name already exists in this workspace', 409);
    }

    const list = this.listRepo.create({
      workspace_id: workspaceId,
      name,
      is_primary: isPrimary ? 1 : 0,
    });

    const saved = await this.listRepo.save(list);
    logger.info('List created', { id: saved.id, workspaceId, name });
    return saved;
  }

  async findById(id: number): Promise<ContactList | null> {
    return this.listRepo.findOne({ where: { id } });
  }

  async getListsByWorkspace(workspaceId: number): Promise<ContactList[]> {
    return this.listRepo.find({
      where: { workspace_id: workspaceId },
      order: { created_at: 'ASC' },
    });
  }

  async assignToContact(contactId: number, listId: number, userId: number): Promise<ContactListAssignment> {
    const list = await this.listRepo.findOne({ where: { id: listId } });
    if (!list) {
      throw new AppError('NOT_FOUND', 'List not found', 404);
    }

    const contact = await this.contactRepo.findOne({ where: { id: contactId, user_id: userId } });
    if (!contact) {
      throw new AppError('NOT_FOUND', 'Contact not found', 404);
    }

    // Contact assignment logic for v1.5
    if (contact.workspace_id === null) {
      contact.workspace_id = list.workspace_id;
      await this.contactRepo.save(contact);
    } else if (contact.workspace_id !== list.workspace_id) {
      throw new AppError('FORBIDDEN', 'Contact and list must belong to the same workspace', 403);
    }

    const existingAssignment = await this.assignmentRepo.findOne({
      where: { contact_id: contactId, list_id: listId },
    });
    if (existingAssignment) {
      throw new AppError('DUPLICATE', 'Contact is already assigned to this list', 409);
    }

    // Enforce one primary list per contact
    if (list.is_primary === 1) {
      const primaryLists = await this.listRepo.find({
        where: { workspace_id: list.workspace_id, is_primary: 1 },
      });
      const primaryListIds = primaryLists.map(l => l.id);

      for (const primaryListId of primaryListIds) {
        if (primaryListId === listId) continue;
        const existing = await this.assignmentRepo.findOne({
          where: { contact_id: contactId, list_id: primaryListId },
        });
        if (existing) {
          await this.assignmentRepo.remove(existing);
          logger.info('Removed contact from primary list', {
            contactId,
            oldListId: primaryListId,
            newListId: listId,
          });
        }
      }
    }

    const assignment = this.assignmentRepo.create({
      contact_id: contactId,
      list_id: listId,
    });

    const saved = await this.assignmentRepo.save(assignment);
    logger.info('Contact assigned to list', { contactId, listId });
    return saved;
  }

  async removeAssignment(contactId: number, listId: number): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { contact_id: contactId, list_id: listId },
    });
    if (!assignment) {
      throw new AppError('NOT_FOUND', 'Assignment not found', 404);
    }

    await this.assignmentRepo.remove(assignment);
    logger.info('Assignment removed', { contactId, listId });
  }

  async getListsForContact(contactId: number): Promise<ContactList[]> {
    const assignments = await this.assignmentRepo.find({
      where: { contact_id: contactId },
    });

    if (assignments.length === 0) return [];

    const listIds = assignments.map(a => a.list_id);
    return this.listRepo.find({
      where: { id: In(listIds) },
    });
  }

  async deleteList(id: number, workspaceId: number): Promise<void> {
    const list = await this.listRepo.findOne({ where: { id } });
    if (!list) {
      throw new AppError('NOT_FOUND', 'List not found', 404);
    }
    if (list.workspace_id !== workspaceId) {
      throw new AppError('FORBIDDEN', 'List does not belong to this workspace', 403);
    }

    await this.listRepo.remove(list);
    logger.info('List deleted', { id });
  }
}
