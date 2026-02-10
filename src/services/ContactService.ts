import { DataSource, Repository } from 'typeorm';
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

  async create(userId: number, data: CreateContactData & { workspaceId?: number }): Promise<BaseContact> {
    if (data.primaryEmail) {
      const emailDup = await this.repository.findOne({
        where: { user_id: userId, primary_email: data.primaryEmail },
      });
      if (emailDup) {
        throw new AppError('DUPLICATE', 'A contact with this email already exists', 409);
      }
    }

    if (data.primaryPhone) {
      const phoneDup = await this.repository.findOne({
        where: { user_id: userId, primary_phone: data.primaryPhone },
      });
      if (phoneDup) {
        throw new AppError('DUPLICATE', 'A contact with this phone already exists', 409);
      }
    }

    const contact = this.repository.create({
      user_id: userId,
      workspace_id: data.workspaceId || null,
      first_name: data.firstName || null,
      last_name: data.lastName || null,
      primary_email: data.primaryEmail || null,
      primary_phone: data.primaryPhone || null,
      company: data.company || null,
    });

    const saved = await this.repository.save(contact);
    logger.info('Contact created', { id: saved.id, workspaceId: saved.workspace_id });
    return saved;
  }

  async findById(id: number, userId: number): Promise<BaseContact | null> {
    return this.repository.findOne({ where: { id, user_id: userId } });
  }

  async findByWorkspace(workspaceId: number, userId: number): Promise<BaseContact[]> {
    return this.repository.find({
      where: { workspace_id: workspaceId, user_id: userId },
      order: { created_on: 'DESC' },
    });
  }

  async findByUser(userId: number): Promise<BaseContact[]> {
    return this.repository.find({
      where: { user_id: userId },
      order: { created_on: 'DESC' },
    });
  }

  async update(id: number, userId: number, data: UpdateContactData & { workspaceId?: number | null }): Promise<BaseContact> {
    const contact = await this.repository.findOne({ where: { id, user_id: userId } });
    if (!contact) {
      throw new AppError('NOT_FOUND', 'Contact not found', 404);
    }

    if (data.primaryEmail && data.primaryEmail !== contact.primary_email) {
      const emailDup = await this.repository.findOne({
        where: { user_id: userId, primary_email: data.primaryEmail },
      });
      if (emailDup && emailDup.id !== id) {
        throw new AppError('DUPLICATE', 'A contact with this email already exists', 409);
      }
    }

    if (data.primaryPhone && data.primaryPhone !== contact.primary_phone) {
      const phoneDup = await this.repository.findOne({
        where: { user_id: userId, primary_phone: data.primaryPhone },
      });
      if (phoneDup && phoneDup.id !== id) {
        throw new AppError('DUPLICATE', 'A contact with this phone already exists', 409);
      }
    }

    if (data.firstName !== undefined) contact.first_name = data.firstName || null;
    if (data.lastName !== undefined) contact.last_name = data.lastName || null;
    if (data.primaryEmail !== undefined) contact.primary_email = data.primaryEmail || null;
    if (data.primaryPhone !== undefined) contact.primary_phone = data.primaryPhone || null;
    if (data.company !== undefined) contact.company = data.company || null;
    if (data.workspaceId !== undefined) contact.workspace_id = data.workspaceId;

    const saved = await this.repository.save(contact);
    logger.info('Contact updated', { id });
    return saved;
  }

  async delete(id: number, userId: number): Promise<void> {
    const contact = await this.repository.findOne({ where: { id, user_id: userId } });
    if (!contact) {
      throw new AppError('NOT_FOUND', 'Contact not found', 404);
    }

    await this.repository.remove(contact);
    logger.info('Contact deleted', { id });
  }
}
