import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { CampaignService } from '../services/CampaignService';
import { WorkspaceService } from '../services/WorkspaceService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const createSchema = Joi.object({
  workspaceId: Joi.number().integer().required(),
  name: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string().valid('one-off', 'scheduled', 'drip').required(),
  templateId: Joi.number().integer().optional().allow(null),
  segment: Joi.object().optional(),
  schedule: Joi.object().optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  type: Joi.string().valid('one-off', 'scheduled', 'drip').optional(),
  templateId: Joi.number().integer().optional().allow(null),
  segment: Joi.object().optional(),
  schedule: Joi.object().optional(),
});

const approvalSchema = Joi.object({
  notes: Joi.string().trim().max(500).optional(),
});

export class CampaignController {
  public router: Router;

  constructor(
    private campaignService: CampaignService,
    private workspaceService: WorkspaceService
  ) {
    this.router = Router();
    this.router.use(requireLogin);

    this.router.get('/pending-approvals', this.getPendingApprovals.bind(this));
    this.router.get('/by-workspace/:workspaceId', this.getByWorkspace.bind(this));
    this.router.post('/', this.create.bind(this));
    this.router.get('/:id', this.getOne.bind(this));
    this.router.put('/:id', this.update.bind(this));
    this.router.delete('/:id', this.delete.bind(this));
    this.router.post('/:id/approve', this.approve.bind(this));
    this.router.post('/:id/reject', this.reject.bind(this));
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

  private async getPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const campaigns = await this.campaignService.getPendingApprovalsForUser(userId);
      res.json({ data: campaigns, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getByWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = parseInt(req.params.workspaceId as string, 10);
      if (isNaN(workspaceId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid workspace ID', 400);
      }

      const userId = (req.session as any).userId;
      await this.verifyWorkspaceAccess(workspaceId, userId);

      const campaigns = await this.campaignService.listByWorkspace(workspaceId);
      res.json({ data: campaigns, error: null });
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

      const userId = (req.session as any).userId;
      await this.verifyWorkspaceAccess(value.workspaceId, userId);

      const campaign = await this.campaignService.create(value);
      res.status(201).json({ data: campaign, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid campaign ID', 400);
      }

      const campaign = await this.campaignService.findById(id);
      if (!campaign) {
        throw new AppError('NOT_FOUND', 'Campaign not found', 404);
      }

      const userId = (req.session as any).userId;
      await this.verifyWorkspaceAccess(campaign.workspace_id, userId);

      res.json({ data: campaign, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid campaign ID', 400);
      }

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const campaign = await this.campaignService.findById(id);
      if (!campaign) {
        throw new AppError('NOT_FOUND', 'Campaign not found', 404);
      }

      const userId = (req.session as any).userId;
      await this.verifyWorkspaceAccess(campaign.workspace_id, userId);

      const updated = await this.campaignService.update(id, campaign.workspace_id, value);
      res.json({ data: updated, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid campaign ID', 400);
      }

      const campaign = await this.campaignService.findById(id);
      if (!campaign) {
        throw new AppError('NOT_FOUND', 'Campaign not found', 404);
      }

      const userId = (req.session as any).userId;
      await this.verifyWorkspaceAccess(campaign.workspace_id, userId);

      await this.campaignService.delete(id, campaign.workspace_id);
      res.json({ data: { message: 'Campaign deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid campaign ID', 400);
      }

      const { error, value } = approvalSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const campaign = await this.campaignService.findById(id);
      if (!campaign) {
        throw new AppError('NOT_FOUND', 'Campaign not found', 404);
      }

      const userId = (req.session as any).userId;
      await this.verifyWorkspaceAccess(campaign.workspace_id, userId);

      const approved = await this.campaignService.approveCampaign(id, campaign.workspace_id, userId, value.notes);
      res.json({ data: approved, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid campaign ID', 400);
      }

      const { error, value } = approvalSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const campaign = await this.campaignService.findById(id);
      if (!campaign) {
        throw new AppError('NOT_FOUND', 'Campaign not found', 404);
      }

      const userId = (req.session as any).userId;
      await this.verifyWorkspaceAccess(campaign.workspace_id, userId);

      const rejected = await this.campaignService.rejectCampaign(id, campaign.workspace_id, userId, value.notes);
      res.json({ data: rejected, error: null });
    } catch (err) {
      next(err);
    }
  }
}
