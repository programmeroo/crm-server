import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { PromptFileService } from '../services/PromptFileService';
import { WorkspaceService } from '../services/WorkspaceService';
import { ListService } from '../services/ListService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const createSchema = Joi.object({
  workspaceId: Joi.number().integer().required(),
  listId: Joi.number().integer().optional().allow(null),
  name: Joi.string().trim().min(1).max(200).required(),
  content: Joi.string().required(),
  description: Joi.string().trim().max(500).optional().allow(null, ''),
});

const updateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  content: Joi.string().optional(),
  description: Joi.string().trim().max(500).optional().allow(null, ''),
});

export class PromptController {
  public router: Router;

  constructor(
    private promptService: PromptFileService,
    private workspaceService: WorkspaceService,
    private listService: ListService
  ) {
    this.router = Router();
    this.router.use(requireLogin);

    this.router.get('/by-workspace/:workspaceId', this.getByWorkspace.bind(this));
    this.router.get('/by-list/:workspaceId/:listId', this.getByList.bind(this));
    this.router.post('/', this.create.bind(this));
    this.router.get('/:filename', this.getOne.bind(this));
    this.router.post('/:filename', this.update.bind(this));
    this.router.delete('/:filename', this.delete.bind(this));
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

  private async getByWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = parseInt(req.params.workspaceId as string, 10);
      if (isNaN(workspaceId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid workspace ID', 400);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(workspaceId, userId);

      const prompts = await this.promptService.listByWorkspace(workspaceId);
      res.json({ data: prompts, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getByList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = parseInt(req.params.workspaceId as string, 10);
      const listId = parseInt(req.params.listId as string, 10);

      if (isNaN(workspaceId) || isNaN(listId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid IDs', 400);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(workspaceId, userId);

      const prompts = await this.promptService.listByWorkspaceAndList(workspaceId, listId);
      res.json({ data: prompts, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(value.workspaceId, userId);

      // If listId provided, verify it belongs to the workspace
      if (value.listId) {
        const list = await this.listService.findById(value.listId);
        if (!list || list.workspace_id !== value.workspaceId) {
          throw new AppError('FORBIDDEN', 'List does not belong to this workspace', 403);
        }
      }

      const prompt = await this.promptService.create(value);
      res.status(201).json({ data: prompt, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filename = req.params.filename as string;

      const prompt = await this.promptService.findByFilename(filename);
      if (!prompt) {
        throw new AppError('NOT_FOUND', 'Prompt not found', 404);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(prompt.workspaceId, userId);

      res.json({ data: prompt, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filename = req.params.filename as string;

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const prompt = await this.promptService.findByFilename(filename);
      if (!prompt) {
        throw new AppError('NOT_FOUND', 'Prompt not found', 404);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(prompt.workspaceId, userId);

      const updated = await this.promptService.update(filename, prompt.workspaceId, value);
      res.json({ data: updated, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filename = req.params.filename as string;

      const prompt = await this.promptService.findByFilename(filename);
      if (!prompt) {
        throw new AppError('NOT_FOUND', 'Prompt not found', 404);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(prompt.workspaceId, userId);

      await this.promptService.delete(filename, prompt.workspaceId);
      res.json({ data: { message: 'Prompt deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }
}
