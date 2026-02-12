import { DataSource, Repository, LessThanOrEqual } from 'typeorm';
import { Todo } from '../entities/Todo.entity';
import { Workspace } from '../entities/Workspace.entity';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';

interface CreateTodoData {
  contactId?: number | null;
  workspaceId: number;
  text: string;
  dueDate?: string | null;
  createdBy: number;
}

interface UpdateTodoData {
  text?: string;
  dueDate?: string | null;
  isComplete?: boolean;
}

export class TodoService {
  private repository: Repository<Todo>;
  private workspaceRepository: Repository<Workspace>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Todo);
    this.workspaceRepository = this.dataSource.getRepository(Workspace);
  }

  async create(data: CreateTodoData): Promise<Todo> {
    try {
      // Verify workspace exists
      const workspace = await this.workspaceRepository.findOne({
        where: { id: data.workspaceId },
      });
      if (!workspace) {
        throw new AppError('NOT_FOUND', 'Workspace not found', 404);
      }

      const todo = this.repository.create({
        contact_id: data.contactId || null,
        workspace_id: data.workspaceId,
        text: data.text,
        due_date: data.dueDate || null,
        created_by: data.createdBy,
      });

      const saved = await this.repository.save(todo);
      logger.info('Todo created', { id: saved.id, contactId: data.contactId });
      return saved;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error creating todo', err);
      throw new AppError('DATABASE_ERROR', 'Failed to create todo', 500);
    }
  }

  async findById(id: number, userId: number): Promise<Todo | null> {
    try {
      const todo = await this.repository.findOne({
        where: { id },
        relations: ['workspace', 'contact'],
      });
      if (!todo) return null;

      // Verify user owns workspace
      if (todo.workspace.user_id !== userId) {
        throw new AppError('FORBIDDEN', 'Not your workspace', 403);
      }

      return todo;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error finding todo', { id, err });
      throw new AppError('DATABASE_ERROR', 'Failed to find todo', 500);
    }
  }

  async findByContact(contactId: number, userId: number): Promise<Todo[]> {
    try {
      const todos = await this.repository.find({
        where: { contact_id: contactId },
        relations: ['workspace'],
        order: { due_date: 'ASC', created_at: 'DESC' },
      });

      // Verify user owns workspace
      for (const todo of todos) {
        if (todo.workspace.user_id !== userId) {
          throw new AppError('FORBIDDEN', 'Not your workspace', 403);
        }
      }

      return todos;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error finding todos by contact', { contactId, err });
      throw new AppError('DATABASE_ERROR', 'Failed to find todos', 500);
    }
  }

  async findByWorkspace(
    workspaceId: number,
    userId: number,
    filters?: { isComplete?: boolean }
  ): Promise<Todo[]> {
    try {
      // Verify workspace ownership
      const workspace = await this.workspaceRepository.findOne({
        where: { id: workspaceId },
      });
      if (!workspace || workspace.user_id !== userId) {
        throw new AppError('FORBIDDEN', 'Not your workspace', 403);
      }

      const query: any = { workspace_id: workspaceId };
      if (filters?.isComplete !== undefined) {
        query.is_complete = filters.isComplete ? 1 : 0;
      }

      const todos = await this.repository.find({
        where: query,
        relations: ['contact'],
        order: { due_date: 'ASC', created_at: 'DESC' },
      });

      return todos;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error finding todos by workspace', { workspaceId, err });
      throw new AppError('DATABASE_ERROR', 'Failed to find todos', 500);
    }
  }

  async findByUser(userId: number, filters?: { isComplete?: boolean; dueToday?: boolean }): Promise<Todo[]> {
    try {
      // Get all workspaces for user
      const workspaces = await this.workspaceRepository.find({
        where: { user_id: userId },
      });
      const workspaceIds = workspaces.map(w => w.id);

      if (workspaceIds.length === 0) return [];

      const query: any = { workspace_id: {} };
      (query.workspace_id as any).IN = workspaceIds;

      if (filters?.isComplete !== undefined) {
        query.is_complete = filters.isComplete ? 1 : 0;
      }

      const todos = await this.repository
        .createQueryBuilder('todo')
        .where('todo.workspace_id IN (:...workspaceIds)', { workspaceIds })
        .andWhere(filters?.isComplete !== undefined ? 'todo.is_complete = :isComplete' : '1=1', {
          isComplete: filters?.isComplete ? 1 : 0,
        })
        .orderBy('todo.due_date', 'ASC', 'NULLS LAST')
        .addOrderBy('todo.created_at', 'DESC')
        .getMany();

      return todos;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error finding todos by user', { userId, err });
      throw new AppError('DATABASE_ERROR', 'Failed to find todos', 500);
    }
  }

  async update(id: number, userId: number, data: UpdateTodoData): Promise<Todo> {
    try {
      const todo = await this.findById(id, userId);
      if (!todo) {
        throw new AppError('NOT_FOUND', 'Todo not found', 404);
      }

      const updates: any = {};
      if (data.text !== undefined) updates.text = data.text;
      if (data.dueDate !== undefined) updates.due_date = data.dueDate;
      if (data.isComplete !== undefined) updates.is_complete = data.isComplete ? 1 : 0;

      if (Object.keys(updates).length === 0) {
        return todo;
      }

      await this.repository.update(id, updates);
      logger.info('Todo updated', { id });

      const updated = await this.repository.findOne({ where: { id } });
      return updated!;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error updating todo', { id, err });
      throw new AppError('DATABASE_ERROR', 'Failed to update todo', 500);
    }
  }

  async delete(id: number, userId: number): Promise<void> {
    try {
      const todo = await this.findById(id, userId);
      if (!todo) {
        throw new AppError('NOT_FOUND', 'Todo not found', 404);
      }

      await this.repository.delete(id);
      logger.info('Todo deleted', { id });
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error deleting todo', { id, err });
      throw new AppError('DATABASE_ERROR', 'Failed to delete todo', 500);
    }
  }

  async markComplete(id: number, userId: number): Promise<Todo> {
    return this.update(id, userId, { isComplete: true });
  }

  async getDueReminders(): Promise<(Todo & { user?: any })[]> {
    try {
      const now = new Date().toISOString();
      const todos = await this.repository
        .createQueryBuilder('todo')
        .leftJoinAndSelect('todo.workspace', 'workspace')
        .leftJoinAndSelect('workspace.user', 'user')
        .where('todo.due_date <= :now', { now })
        .andWhere('todo.is_complete = 0')
        .getMany();

      return todos as any[];
    } catch (err) {
      logger.error('Error getting due reminders', err);
      throw new AppError('DATABASE_ERROR', 'Failed to get reminders', 500);
    }
  }
}
