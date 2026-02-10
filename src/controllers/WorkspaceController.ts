import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { WorkspaceService } from '../services/WorkspaceService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const createSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
});

const updateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
});

export class WorkspaceController {
  public router: Router;

  constructor(private workspaceService: WorkspaceService) {
    this.router = Router();
    this.router.use(requireLogin);
    this.router.get('/', this.list.bind(this));
    this.router.post('/', this.create.bind(this));
    this.router.put('/:id', this.update.bind(this));
    this.router.delete('/:id', this.delete.bind(this));
  }

  private async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaces = await this.workspaceService.listByUser((req.session as any).userId!);
      res.json({ data: workspaces, error: null });
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

      const workspace = await this.workspaceService.create((req.session as any).userId!, value.name);
      res.status(201).json({ data: workspace, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const workspace = await this.workspaceService.update(
        Number(req.params.id),
        (req.session as any).userId!,
        value.name
      );
      res.json({ data: workspace, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.workspaceService.delete(Number(req.params.id), (req.session as any).userId!);
      res.json({ data: { message: 'Workspace deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }
}
