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

  async createList(workspaceId: number, name: string): Promise<ContactList> {
    const existing = await this.listRepo.findOne({
      where: { workspace_id: workspaceId, name },
    });
    if (existing) {
      throw new AppError('DUPLICATE', 'A list with this name already exists in this workspace', 409);
    }

    const list = this.listRepo.create({
      workspace_id: workspaceId,
      name,
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

  async assignToContact(contactId: number, listId: number, userId: number, makePrimary: boolean = false): Promise<ContactListAssignment> {
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

    // Determine if this should be marked primary
    const existingAssignments = await this.assignmentRepo.find({
      where: { contact_id: contactId },
    });

    // Get assignments in the same workspace
    const existingWorkspaceAssignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect(ContactList, 'l', 'a.list_id = l.id')
      .where('a.contact_id = :contactId', { contactId })
      .andWhere('l.workspace_id = :workspaceId', { workspaceId: list.workspace_id })
      .getMany();

    const hasPrimaryInWorkspace = existingWorkspaceAssignments.some(a => a.is_primary === 1);
    let isPrimary = makePrimary || !hasPrimaryInWorkspace;

    // If making this primary, unmark any other primary in this workspace
    if (isPrimary && hasPrimaryInWorkspace) {
      for (const assignment of existingWorkspaceAssignments) {
        if (assignment.is_primary === 1) {
          assignment.is_primary = 0;
          await this.assignmentRepo.save(assignment);
          logger.info('Unmarked previous primary assignment', { contactId, oldListId: assignment.list_id });
        }
      }
    }

    const assignment = this.assignmentRepo.create({
      contact_id: contactId,
      list_id: listId,
      is_primary: isPrimary ? 1 : 0,
    });

    const saved = await this.assignmentRepo.save(assignment);
    logger.info('Contact assigned to list', { contactId, listId, isPrimary });
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

  async getListsForContact(contactId: number): Promise<(ContactList & { is_primary: number })[]> {
    const assignments = await this.assignmentRepo.find({
      where: { contact_id: contactId },
    });

    if (assignments.length === 0) return [];

    const listIds = assignments.map(a => a.list_id);
    const lists = await this.listRepo.find({
      where: { id: In(listIds) },
    });

    // Merge primary status from assignments
    return lists.map(list => {
      const assignment = assignments.find(a => a.list_id === list.id);
      return {
        ...list,
        is_primary: assignment?.is_primary || 0,
      };
    });
  }

  async getPrimaryListForContact(contactId: number, workspaceId: number): Promise<ContactList | null> {
    const assignment = await this.assignmentRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect(ContactList, 'l', 'a.list_id = l.id')
      .where('a.contact_id = :contactId', { contactId })
      .andWhere('l.workspace_id = :workspaceId', { workspaceId })
      .andWhere('a.is_primary = 1')
      .getOne();

    return assignment ? assignment.list : null;
  }

  async setAssignmentAsPrimary(contactId: number, listId: number, workspaceId: number): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { contact_id: contactId, list_id: listId },
    });

    if (!assignment) {
      throw new AppError('NOT_FOUND', 'Assignment not found', 404);
    }

    // Get the workspace id for this list to check workspace consistency
    const list = await this.listRepo.findOne({ where: { id: listId } });
    if (!list || list.workspace_id !== workspaceId) {
      throw new AppError('FORBIDDEN', 'List does not belong to this workspace', 403);
    }

    // Unmark any other primary assignments in this workspace
    const existingPrimary = await this.assignmentRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect(ContactList, 'l', 'a.list_id = l.id')
      .where('a.contact_id = :contactId', { contactId })
      .andWhere('l.workspace_id = :workspaceId', { workspaceId })
      .andWhere('a.is_primary = 1')
      .getMany();

    for (const existing of existingPrimary) {
      existing.is_primary = 0;
      await this.assignmentRepo.save(existing);
    }

    // Mark this assignment as primary
    assignment.is_primary = 1;
    await this.assignmentRepo.save(assignment);
    logger.info('Assignment set as primary', { contactId, listId });
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
