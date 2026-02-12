import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { TemplateService } from '../services/TemplateService';
import { WorkspaceService } from '../services/WorkspaceService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const createSchema = Joi.object({
  workspaceId: Joi.number().integer().required(),
  name: Joi.string().trim().min(1).max(200).required(),
  template_type: Joi.string().valid('html', 'text', 'mixed').default('html'),
  subject: Joi.string().trim().max(500).optional().allow(null, ''),
  body: Joi.string().required(),
  preheader: Joi.string().trim().max(200).optional().allow(null, ''),
  signature: Joi.string().trim().optional().allow(null, ''),
});

const updateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  template_type: Joi.string().valid('html', 'text', 'mixed').optional(),
  subject: Joi.string().trim().max(500).optional().allow(null, ''),
  body: Joi.string().optional(),
  preheader: Joi.string().trim().max(200).optional().allow(null, ''),
  signature: Joi.string().trim().optional().allow(null, ''),
});

const generateSchema = Joi.object({
  workspaceId: Joi.number().integer().required(),
  name: Joi.string().trim().min(1).max(200).required(),
  templateType: Joi.string().valid('html', 'text').default('html'),
  goal: Joi.string().trim().required(),
  audience: Joi.string().trim().required(),
  tone: Joi.string().trim().required(),
  mustHaves: Joi.array().items(Joi.string()).default([]),
});

export class TemplateController {
  public router: Router;

  constructor(
    private templateService: TemplateService,
    private workspaceService: WorkspaceService
  ) {
    this.router = Router();
    this.router.use(requireLogin);

    this.router.get('/', this.list.bind(this));
    this.router.post('/', this.create.bind(this));
    this.router.get('/:id', this.getOne.bind(this));
    this.router.put('/:id', this.update.bind(this));
    this.router.delete('/:id', this.delete.bind(this));
    this.router.post('/generate', this.generate.bind(this));
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

  private async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('[TemplateController] GET /api/templates', { query: req.query, userId: (req.session as any).userId });

      const workspaceId = parseInt(req.query.workspaceId as string, 10);
      if (isNaN(workspaceId)) {
        throw new AppError('VALIDATION_ERROR', 'workspaceId is required', 400);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(workspaceId, userId);

      const templates = await this.templateService.listByWorkspace(workspaceId);
      console.log('[TemplateController] Found templates:', templates.map(t => ({ id: t.id, name: t.name })));
      res.json({ data: templates, error: null });
    } catch (err) {
      console.error('[TemplateController] Error listing templates:', err);
      next(err);
    }
  }

  private async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('[TemplateController] POST /api/templates received', { body: req.body, userId: (req.session as any).userId });

      const { error, value } = createSchema.validate(req.body);
      if (error) {
        console.error('[TemplateController] Validation error:', error.details);
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      console.log('[TemplateController] Validation passed, creating template:', { name: value.name, workspace: value.workspaceId });

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(value.workspaceId, userId);

      const template = await this.templateService.create(value.workspaceId, {
        name: value.name,
        template_type: value.template_type,
        subject: value.subject,
        body: value.body,
        preheader: value.preheader,
        signature: value.signature,
      });

      console.log('[TemplateController] Template created successfully:', { id: template.id, name: template.name });
      res.status(201).json({ data: template, error: null });
    } catch (err) {
      console.error('[TemplateController] Error creating template:', err);
      next(err);
    }
  }

  private async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid template ID', 400);
      }

      const template = await this.templateService.findById(id);
      if (!template) {
        throw new AppError('NOT_FOUND', 'Template not found', 404);
      }

      // Verify workspace access
      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(template.workspace_id, userId);

      res.json({ data: template, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid template ID', 400);
      }

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const template = await this.templateService.findById(id);
      if (!template) {
        throw new AppError('NOT_FOUND', 'Template not found', 404);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(template.workspace_id, userId);

      const updated = await this.templateService.update(id, template.workspace_id, value);
      res.json({ data: updated, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid template ID', 400);
      }

      const template = await this.templateService.findById(id);
      if (!template) {
        throw new AppError('NOT_FOUND', 'Template not found', 404);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(template.workspace_id, userId);

      await this.templateService.delete(id, template.workspace_id);
      res.json({ data: { message: 'Template deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = generateSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId!;
      await this.verifyWorkspaceAccess(value.workspaceId, userId);

      const template = await this.templateService.generateWithAI(value.workspaceId, {
        name: value.name,
        templateType: value.templateType,
        goal: value.goal,
        audience: value.audience,
        tone: value.tone,
        mustHaves: value.mustHaves || [],
      });

      res.status(201).json({ data: template, error: null });
    } catch (err) {
      next(err);
    }
  }
}
