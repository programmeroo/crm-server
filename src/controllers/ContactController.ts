import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ContactService } from '../services/ContactService';
import { WorkspaceService } from '../services/WorkspaceService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const createSchema = Joi.object({
  workspaceId: Joi.string().uuid().required(),
  firstName: Joi.string().trim().allow('').optional(),
  lastName: Joi.string().trim().allow('').optional(),
  primaryEmail: Joi.string().email().allow('', null).optional(),
  primaryPhone: Joi.string().trim().allow('', null).optional(),
  company: Joi.string().trim().allow('', null).optional(),
});

const updateSchema = Joi.object({
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
    this.router.get('/workspace/:workspaceId', this.listByWorkspace.bind(this));
    this.router.get('/:id', this.getById.bind(this));
    this.router.put('/:id', this.update.bind(this));
    this.router.delete('/:id', this.delete.bind(this));
  }

  private async verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
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
      const { error, value } = createSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      await this.verifyWorkspaceAccess(value.workspaceId, req.session.userId!);

      const contact = await this.contactService.create(value.workspaceId, {
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

  private async listByWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.params.workspaceId as string;
      await this.verifyWorkspaceAccess(workspaceId, req.session.userId!);

      const contacts = await this.contactService.findByWorkspace(workspaceId);
      res.json({ data: contacts, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contact = await this.contactService.findById(req.params.id as string);
      if (!contact) {
        throw new AppError('NOT_FOUND', 'Contact not found', 404);
      }

      await this.verifyWorkspaceAccess(contact.workspace_id, req.session.userId!);
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

      const contact = await this.contactService.findById(req.params.id as string);
      if (!contact) {
        throw new AppError('NOT_FOUND', 'Contact not found', 404);
      }

      await this.verifyWorkspaceAccess(contact.workspace_id, req.session.userId!);

      const updated = await this.contactService.update(
        req.params.id as string,
        contact.workspace_id,
        value,
      );
      res.json({ data: updated, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contact = await this.contactService.findById(req.params.id as string);
      if (!contact) {
        throw new AppError('NOT_FOUND', 'Contact not found', 404);
      }

      await this.verifyWorkspaceAccess(contact.workspace_id, req.session.userId!);

      await this.contactService.delete(req.params.id as string, contact.workspace_id);
      res.json({ data: { message: 'Contact deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }
}
