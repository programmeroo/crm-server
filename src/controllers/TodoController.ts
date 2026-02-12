import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { TodoService } from '../services/TodoService';
import { WorkspaceService } from '../services/WorkspaceService';
import { ContactService } from '../services/ContactService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const createTodoSchema = Joi.object({
  contactId: Joi.number().optional(),
  workspaceId: Joi.number().integer().required(),
  text: Joi.string().trim().min(1).max(500).required(),
  dueDate: Joi.string().optional(),
});

const updateTodoSchema = Joi.object({
  text: Joi.string().trim().min(1).max(500).optional(),
  dueDate: Joi.string().optional().allow(null),
  isComplete: Joi.boolean().optional(),
});

export class TodoController {
  public router: Router;

  constructor(
    private todoService: TodoService,
    private workspaceService: WorkspaceService,
    private contactService: ContactService
  ) {
    this.router = Router();
    this.router.use(requireLogin);

    this.router.post('/', this.create.bind(this));
    this.router.get('/', this.list.bind(this));
    this.router.get('/:id', this.getOne.bind(this));
    this.router.put('/:id', this.update.bind(this));
    this.router.delete('/:id', this.delete.bind(this));
    this.router.post('/:id/complete', this.markComplete.bind(this));
    this.router.get('/contact/:contactId/todos', this.getContactTodos.bind(this));
  }

  private async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = createTodoSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId;

      // Verify workspace ownership
      const workspace = await this.workspaceService.findById(value.workspaceId);
      if (!workspace || workspace.user_id !== userId) {
        throw new AppError('FORBIDDEN', 'Not your workspace', 403);
      }

      // If contactId provided, verify contact belongs to user
      if (value.contactId) {
        const contact = await this.contactService.findById(value.contactId, userId);
        if (!contact) {
          throw new AppError('FORBIDDEN', 'Not your contact', 403);
        }
      }

      const todo = await this.todoService.create({
        contactId: value.contactId || null,
        workspaceId: value.workspaceId,
        text: value.text,
        dueDate: value.dueDate || null,
        createdBy: userId,
      });

      res.status(201).json({ data: todo, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
      const isComplete = req.query.isComplete ? req.query.isComplete === 'true' : undefined;

      let todos: any[];

      if (workspaceId) {
        todos = await this.todoService.findByWorkspace(workspaceId, userId, { isComplete });
      } else {
        todos = await this.todoService.findByUser(userId, { isComplete });
      }

      res.json({ data: todos, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid todo ID', 400);
      }

      const todo = await this.todoService.findById(id, userId);
      if (!todo) {
        throw new AppError('NOT_FOUND', 'Todo not found', 404);
      }

      res.json({ data: todo, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = updateTodoSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId;
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid todo ID', 400);
      }

      const todo = await this.todoService.update(id, userId, {
        text: value.text,
        dueDate: value.dueDate,
        isComplete: value.isComplete,
      });

      res.json({ data: todo, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid todo ID', 400);
      }

      await this.todoService.delete(id, userId);
      res.json({ data: { message: 'Todo deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async markComplete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid todo ID', 400);
      }

      const todo = await this.todoService.markComplete(id, userId);
      res.json({ data: todo, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getContactTodos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const contactId = parseInt(req.params.contactId as string, 10);

      if (isNaN(contactId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid contact ID', 400);
      }

      const todos = await this.todoService.findByContact(contactId, userId);
      res.json({ data: todos, error: null });
    } catch (err) {
      next(err);
    }
  }
}
