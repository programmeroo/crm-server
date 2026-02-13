import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ListService } from '../services/ListService';
import { WorkspaceService } from '../services/WorkspaceService';
import { ContactService } from '../services/ContactService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const createListSchema = Joi.object({
  workspaceId: Joi.number().integer().required(),
  name: Joi.string().trim().min(1).required(),
});

const setPrimarySchema = Joi.object({
  contactId: Joi.number().integer().required(),
  listId: Joi.number().integer().required(),
  workspaceId: Joi.number().integer().required(),
});

const assignSchema = Joi.object({
  contactId: Joi.number().integer().required(),
  listId: Joi.number().integer().required(),
});

export class ListController {
  public router: Router;

  constructor(
    private listService: ListService,
    private workspaceService: WorkspaceService,
    private contactService: ContactService,
  ) {
    this.router = Router();
    this.router.use(requireLogin);
    // More specific routes must come BEFORE less specific ones
    this.router.get('/by-workspace/:workspaceId', this.getByWorkspace.bind(this));
    this.router.post('/assign/set-primary', this.setPrimary.bind(this));
    this.router.post('/assign', this.assign.bind(this));
    this.router.delete('/assign', this.removeAssignment.bind(this));
    this.router.post('/', this.create.bind(this));
    this.router.delete('/:id', this.delete.bind(this));
  }

  private async getByWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = parseInt(req.params.workspaceId as string, 10);
      if (isNaN(workspaceId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid workspace ID', 400);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(workspaceId, userId);

      const lists = await this.listService.getListsByWorkspace(workspaceId);
      res.json({ data: lists, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async verifyWorkspaceAccess(workspaceId: number, userId: number): Promise<void> {
    const workspace = await this.workspaceService.findById(workspaceId);
    if (!workspace) {
      throw new AppError('NOT_FOUND', 'Workspace not found', 404);
    }
    if (workspace.user_id !== userId) {
      throw new AppError('FORBIDDEN', 'Not your workspace', 403);
    }
  }

  private async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = createListSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(value.workspaceId, userId);

      const list = await this.listService.createList(value.workspaceId, value.name);
      res.status(201).json({ data: list, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = assignSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId!;
      const assignment = await this.listService.assignToContact(value.contactId, value.listId, userId);
      res.status(201).json({ data: assignment, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async removeAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = assignSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      await this.listService.removeAssignment(value.contactId, value.listId);
      res.json({ data: { message: 'Assignment removed' }, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async setPrimary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = setPrimarySchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(value.workspaceId, userId);
      await this.listService.setAssignmentAsPrimary(value.contactId, value.listId, value.workspaceId);
      res.json({ data: { message: 'Primary assignment updated' }, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const listId = parseInt(req.params.id as string, 10);
      if (isNaN(listId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid list ID', 400);
      }

      const userId = (req.session as any).userId!;

      // Get the list to verify workspace access
      const list = await this.listService.findById(listId);
      if (!list) {
        throw new AppError('NOT_FOUND', 'List not found', 404);
      }

      // Verify user owns the workspace
      await this.verifyWorkspaceAccess(list.workspace_id, userId);

      await this.listService.deleteList(listId, list.workspace_id);
      res.json({ data: { message: 'List deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }
}
