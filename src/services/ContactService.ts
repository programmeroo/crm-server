import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BaseContact } from '../entities/BaseContact.entity';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';

interface CreateContactData {
  firstName?: string;
  lastName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  company?: string;
}

interface UpdateContactData {
  firstName?: string;
  lastName?: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  company?: string | null;
}

export class ContactService {
  private repository: Repository<BaseContact>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(BaseContact);
  }

  async create(workspaceId: string, data: CreateContactData): Promise<BaseContact> {
    if (data.primaryEmail) {
      const emailDup = await this.repository.findOne({
        where: { workspace_id: workspaceId, primary_email: data.primaryEmail },
      });
      if (emailDup) {
        throw new AppError('DUPLICATE', 'A contact with this email already exists in this workspace', 409);
      }
    }

    if (data.primaryPhone) {
      const phoneDup = await this.repository.findOne({
        where: { workspace_id: workspaceId, primary_phone: data.primaryPhone },
      });
      if (phoneDup) {
        throw new AppError('DUPLICATE', 'A contact with this phone already exists in this workspace', 409);
      }
    }

    const contact = this.repository.create({
      id: uuidv4(),
      workspace_id: workspaceId,
      first_name: data.firstName || null,
      last_name: data.lastName || null,
      primary_email: data.primaryEmail || null,
      primary_phone: data.primaryPhone || null,
      company: data.company || null,
    });

    const saved = await this.repository.save(contact);
    logger.info('Contact created', { id: saved.id, workspaceId });
    return saved;
  }

  async findById(id: string): Promise<BaseContact | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByWorkspace(workspaceId: string): Promise<BaseContact[]> {
    return this.repository.find({
      where: { workspace_id: workspaceId },
      order: { created_on: 'DESC' },
    });
  }

  async update(id: string, workspaceId: string, data: UpdateContactData): Promise<BaseContact> {
    const contact = await this.repository.findOne({ where: { id } });
    if (!contact) {
      throw new AppError('NOT_FOUND', 'Contact not found', 404);
    }
    if (contact.workspace_id !== workspaceId) {
      throw new AppError('FORBIDDEN', 'Contact does not belong to this workspace', 403);
    }

    if (data.primaryEmail && data.primaryEmail !== contact.primary_email) {
      const emailDup = await this.repository.findOne({
        where: { workspace_id: workspaceId, primary_email: data.primaryEmail },
      });
      if (emailDup && emailDup.id !== id) {
        throw new AppError('DUPLICATE', 'A contact with this email already exists in this workspace', 409);
      }
    }

    if (data.primaryPhone && data.primaryPhone !== contact.primary_phone) {
      const phoneDup = await this.repository.findOne({
        where: { workspace_id: workspaceId, primary_phone: data.primaryPhone },
      });
      if (phoneDup && phoneDup.id !== id) {
        throw new AppError('DUPLICATE', 'A contact with this phone already exists in this workspace', 409);
      }
    }

    if (data.firstName !== undefined) contact.first_name = data.firstName || null;
    if (data.lastName !== undefined) contact.last_name = data.lastName || null;
    if (data.primaryEmail !== undefined) contact.primary_email = data.primaryEmail || null;
    if (data.primaryPhone !== undefined) contact.primary_phone = data.primaryPhone || null;
    if (data.company !== undefined) contact.company = data.company || null;

    const saved = await this.repository.save(contact);
    logger.info('Contact updated', { id });
    return saved;
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    const contact = await this.repository.findOne({ where: { id } });
    if (!contact) {
      throw new AppError('NOT_FOUND', 'Contact not found', 404);
    }
    if (contact.workspace_id !== workspaceId) {
      throw new AppError('FORBIDDEN', 'Contact does not belong to this workspace', 403);
    }

    await this.repository.remove(contact);
    logger.info('Contact deleted', { id });
  }
}
