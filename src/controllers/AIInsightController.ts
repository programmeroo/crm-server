import { Router, Request, Response, NextFunction } from 'express';
import { AIInsightService } from '../services/AIInsightService';
import { WorkspaceService } from '../services/WorkspaceService';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';
import Joi from 'joi';

export class AIInsightController {
  public router: Router;

  constructor(
    private aiInsightService: AIInsightService,
    private workspaceService: WorkspaceService,
  ) {
    this.router = Router();
    this.router.get('/', this.list.bind(this));
    this.router.post('/generate', this.generate.bind(this));
    this.router.get('/:id', this.getById.bind(this));
    this.router.delete('/:id', this.dismiss.bind(this));
  }

  /**
   * GET /api/ai-insights
   * List insights for authenticated user with optional filters
   */
  private async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
      }

      // Validate query parameters
      const schema = Joi.object({
        dismissed: Joi.boolean().default(false),
        limit: Joi.number().integer().min(1).max(100).default(10),
        type: Joi.string()
          .valid('Optimization', 'Income Idea', 'Pattern Recognition', 'Anomaly', 'Recommendation', 'Risk')
          .optional(),
      });

      const { error, value } = schema.validate(req.query);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const insights = await this.aiInsightService.findByUser(userId, {
        dismissed: value.dismissed,
        limit: value.limit,
        type: value.type,
      });

      res.status(200).json({ data: insights, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/ai-insights/generate
   * Generate new insights for user
   */
  private async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
      }

      logger.info(`Generating insights for user ${userId}`);

      const insights = await this.aiInsightService.generateInsights(userId);

      res.status(201).json({ data: insights, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/ai-insights/:id
   * Get a single insight by ID
   */
  private async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
      }

      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid insight ID', 400);
      }

      const insight = await this.aiInsightService.findById(id);
      if (!insight) {
        throw new AppError('NOT_FOUND', 'Insight not found', 404);
      }

      // Check ownership
      if (insight.user_id !== userId) {
        throw new AppError('FORBIDDEN', 'You do not have permission to view this insight', 403);
      }

      res.status(200).json({ data: insight, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/ai-insights/:id
   * Dismiss (soft delete) an insight
   */
  private async dismiss(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
      }

      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid insight ID', 400);
      }

      await this.aiInsightService.dismiss(id, userId);

      res.status(200).json({ data: null, error: null });
    } catch (err) {
      next(err);
    }
  }
}
