import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ContactService } from '../services/ContactService';
import { WorkspaceService } from '../services/WorkspaceService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const createSchema = Joi.object({
  workspaceId: Joi.number().integer().optional(),
  firstName: Joi.string().trim().allow('').optional(),
  lastName: Joi.string().trim().allow('').optional(),
  primaryEmail: Joi.string().email().allow('', null).optional(),
  primaryPhone: Joi.string().trim().allow('', null).optional(),
  company: Joi.string().trim().allow('', null).optional(),
});

const updateSchema = Joi.object({
  workspaceId: Joi.number().integer().allow(null).optional(),
  firstName: Joi.string().trim().allow('', null).optional(),
  lastName: Joi.string().trim().allow('', null).optional(),
  primaryEmail: Joi.string().email().allow('', null).optional(),
  primaryPhone: Joi.string().trim().allow('', null).optional(),
  company: Joi.string().trim().allow('', null).optional(),
});

export class ContactController {
  public router: Router;

  constructor(
    private contactService: ContactService,
    private workspaceService: WorkspaceService,
  ) {
    this.router = Router();
    this.router.use(requireLogin);
    this.router.post('/', this.create.bind(this));
    this.router.get('/', this.listByUser.bind(this));
    this.router.get('/workspace/:workspaceId', this.listByWorkspace.bind(this));
    this.router.get('/:id', this.getById.bind(this));
    this.router.put('/:id', this.update.bind(this));
    this.router.delete('/:id', this.delete.bind(this));
  }


  private async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId!;
      if (value.workspaceId) {
        const workspace = await this.workspaceService.findById(value.workspaceId);
        if (!workspace || workspace.user_id !== userId) {
          throw new AppError('FORBIDDEN', 'Workspace not found or no access', 403);
        }
      }

      const contact = await this.contactService.create(userId, {
        workspaceId: value.workspaceId,
        firstName: value.firstName,
        lastName: value.lastName,
        primaryEmail: value.primaryEmail,
        primaryPhone: value.primaryPhone,
        company: value.company,
      });
      res.status(201).json({ data: contact, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async listByUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contacts = await this.contactService.findByUser((req.session as any).userId!);
      res.json({ data: contacts, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async listByWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = Number(req.params.workspaceId);
      const userId = (req.session as any).userId!;

      const contacts = await this.contactService.findByWorkspace(workspaceId, userId);
      res.json({ data: contacts, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contact = await this.contactService.findById(Number(req.params.id), (req.session as any).userId!);
      if (!contact) {
        throw new AppError('NOT_FOUND', 'Contact not found', 404);
      }
      res.json({ data: contact, error: null });
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

      const updated = await this.contactService.update(
        Number(req.params.id),
        (req.session as any).userId!,
        value,
      );
      res.json({ data: updated, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.contactService.delete(Number(req.params.id), (req.session as any).userId!);
      res.json({ data: { message: 'Contact deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }
}
