import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { CommunicationLogService } from '../services/CommunicationLogService';
import { ContactService } from '../services/ContactService';
import { WorkspaceService } from '../services/WorkspaceService';
import { TodoService } from '../services/TodoService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const manualLogSchema = Joi.object({
  type: Joi.string().valid('email', 'text', 'call', 'note').required(),
  content: Joi.object().required(),
  status: Joi.string().optional(),
  createTodo: Joi.boolean().optional(),
  todoText: Joi.string().optional(),
  todoDueDate: Joi.string().optional(),
});

export class CommunicationLogController {
  public router: Router;

  constructor(
    private communicationLogService: CommunicationLogService,
    private contactService: ContactService,
    private workspaceService: WorkspaceService,
    private todoService: TodoService
  ) {
    this.router = Router();
    this.router.use(requireLogin);

    this.router.get('/contacts/:contactId/logs', this.getContactLogs.bind(this));
    this.router.post('/contacts/:contactId/logs', this.logManual.bind(this));
    this.router.post('/poll-emails', this.pollEmails.bind(this));
    this.router.post('/poll-sms', this.pollSMS.bind(this));
    this.router.get('/workspaces/:workspaceId/logs', this.getWorkspaceLogs.bind(this));
  }

  private async getContactLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const contactId = parseInt(req.params.contactId as string, 10);

      if (isNaN(contactId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid contact ID', 400);
      }

      const logs = await this.communicationLogService.findByContact(contactId, userId);

      // Parse content JSON
      const parsed = logs.map(log => ({
        ...log,
        content: JSON.parse(log.content),
      }));

      res.json({ data: parsed, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async logManual(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = manualLogSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId;
      const contactId = parseInt(req.params.contactId as string, 10);

      if (isNaN(contactId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid contact ID', 400);
      }

      const result = await this.communicationLogService.logManual(
        {
          contactId,
          userId,
          type: value.type,
          content: value.content,
          createTodo: value.createTodo,
          todoText: value.todoText,
          todoDueDate: value.todoDueDate || null,
        },
        this.todoService
      );

      res.status(201).json({
        data: {
          log: { ...result.log, content: JSON.parse(result.log.content) },
          todo: result.todo,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  private async pollEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const result = await this.communicationLogService.pollEmails(userId);
      res.json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async pollSMS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const result = await this.communicationLogService.pollSMS(userId);
      res.json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getWorkspaceLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const workspaceId = parseInt(req.params.workspaceId as string, 10);
      const type = req.query.type as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      if (isNaN(workspaceId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid workspace ID', 400);
      }

      const logs = await this.communicationLogService.findByWorkspace(workspaceId, userId, {
        type,
        limit,
      });

      // Parse content JSON
      const parsed = logs.map(log => ({
        ...log,
        content: JSON.parse(log.content),
      }));

      res.json({ data: parsed, error: null });
    } catch (err) {
      next(err);
    }
  }
}
