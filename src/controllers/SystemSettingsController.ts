import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { SystemSettingsService } from '../services/SystemSettingsService';
import { WorkspaceService } from '../services/WorkspaceService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const updateSettingSchema = Joi.object({
  value: Joi.any().required(),
});

export class SystemSettingsController {
  public router: Router;

  constructor(
    private settingsService: SystemSettingsService,
    private workspaceService: WorkspaceService
  ) {
    this.router = Router();
    this.router.use(requireLogin);

    this.router.get('/user', this.getUserSettings.bind(this));
    this.router.put('/user/:key', this.setUserSetting.bind(this));

    this.router.get('/workspace/:workspaceId', this.getWorkspaceSettings.bind(this));
    this.router.put('/workspace/:workspaceId/:key', this.setWorkspaceSetting.bind(this));
  }

  private async getUserSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const settings = await this.settingsService.getUserSettings(userId);
      res.json({ data: settings, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async setUserSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = updateSettingSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId;
      const key = req.params.key as string;

      await this.settingsService.setSetting('user', userId.toString(), key, value.value);
      res.json({ data: { message: 'Setting updated' }, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getWorkspaceSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      const workspaceId = parseInt(req.params.workspaceId as string, 10);

      if (isNaN(workspaceId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid workspace ID', 400);
      }

      // Verify workspace ownership
      const workspace = await this.workspaceService.findById(workspaceId);
      if (!workspace || workspace.user_id !== userId) {
        throw new AppError('FORBIDDEN', 'Not your workspace', 403);
      }

      const settings = await this.settingsService.getWorkspaceSettings(workspaceId);
      res.json({ data: settings, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async setWorkspaceSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = updateSettingSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId;
      const workspaceId = parseInt(req.params.workspaceId as string, 10);
      const key = req.params.key as string;

      if (isNaN(workspaceId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid workspace ID', 400);
      }

      // Verify workspace ownership
      const workspace = await this.workspaceService.findById(workspaceId);
      if (!workspace || workspace.user_id !== userId) {
        throw new AppError('FORBIDDEN', 'Not your workspace', 403);
      }

      await this.settingsService.setSetting('workspace', workspaceId.toString(), key, value.value);
      res.json({ data: { message: 'Setting updated' }, error: null });
    } catch (err) {
      next(err);
    }
  }
}
