import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Workspace } from '../entities/Workspace.entity';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';

export class WorkspaceService {
  private repository: Repository<Workspace>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Workspace);
  }

  async create(userId: string, name: string): Promise<Workspace> {
    const existing = await this.repository.findOne({
      where: { user_id: userId, name },
    });
    if (existing) {
      throw new AppError('DUPLICATE', 'Workspace name already exists', 409);
    }

    const workspace = this.repository.create({
      id: uuidv4(),
      user_id: userId,
      name,
    });

    const saved = await this.repository.save(workspace);
    logger.info('Workspace created', { id: saved.id, userId, name });
    return saved;
  }

  async listByUser(userId: string): Promise<Workspace[]> {
    return this.repository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.repository.findOne({ where: { id } });
  }

  async update(id: string, userId: string, name: string): Promise<Workspace> {
    const workspace = await this.repository.findOne({ where: { id } });
    if (!workspace) {
      throw new AppError('NOT_FOUND', 'Workspace not found', 404);
    }
    if (workspace.user_id !== userId) {
      throw new AppError('FORBIDDEN', 'Not your workspace', 403);
    }

    const duplicate = await this.repository.findOne({
      where: { user_id: userId, name },
    });
    if (duplicate && duplicate.id !== id) {
      throw new AppError('DUPLICATE', 'Workspace name already exists', 409);
    }

    workspace.name = name;
    const saved = await this.repository.save(workspace);
    logger.info('Workspace updated', { id, name });
    return saved;
  }

  async delete(id: string, userId: string): Promise<void> {
    const workspace = await this.repository.findOne({ where: { id } });
    if (!workspace) {
      throw new AppError('NOT_FOUND', 'Workspace not found', 404);
    }
    if (workspace.user_id !== userId) {
      throw new AppError('FORBIDDEN', 'Not your workspace', 403);
    }

    await this.repository.remove(workspace);
    logger.info('Workspace deleted', { id });
  }
}
