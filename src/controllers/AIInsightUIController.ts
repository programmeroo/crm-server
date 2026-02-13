import { Router, Request, Response, NextFunction } from 'express';
import { AIInsightService } from '../services/AIInsightService';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';

export class AIInsightUIController {
  public router: Router;

  constructor(private aiInsightService: AIInsightService) {
    this.router = Router();
    this.router.get('/', this.list.bind(this));
    this.router.post('/generate', this.generate.bind(this));
    this.router.post('/:id/dismiss', this.dismiss.bind(this));
  }

  /**
   * GET /ai-insights
   * Render AI insights page
   */
  private async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.redirect('/auth/login');
      }

      const insights = await this.aiInsightService.findByUser(userId, {
        dismissed: false,
        limit: 100,
      });

      const cooldownInfo = await this.aiInsightService.getCooldownInfo(userId);

      // Format timestamps for display
      const formattedInsights = insights.map((insight) => ({
        ...insight,
        created_at_display: this.formatTimeAgo(new Date(insight.created_at)),
      }));

      res.render('ai-insights/index', {
        insights: formattedInsights,
        canGenerate: cooldownInfo.canGenerate,
        hoursUntilAvailable: cooldownInfo.hoursUntilAvailable,
        lastGenerated: cooldownInfo.lastGenerated
          ? this.formatTimeAgo(new Date(cooldownInfo.lastGenerated))
          : null,
        activePage: 'ai-insights',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /ai-insights/generate
   * Trigger insight generation and redirect
   */
  private async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.redirect('/auth/login');
      }

      logger.info(`User ${userId} requested insight generation`);

      await this.aiInsightService.generateInsights(userId);

      // Set success flash message (if using flash middleware)
      (req.session as any).flash = {
        type: 'success',
        message: 'Insights generated successfully!',
      };

      res.redirect('/ai-insights');
    } catch (err) {
      // Handle specific errors
      if (err instanceof AppError) {
        if (err.code === 'COOLDOWN_ACTIVE') {
          (req.session as any).flash = {
            type: 'warning',
            message: err.message,
          };
          return res.redirect('/ai-insights');
        }

        if (err.code === 'CONFIGURATION_ERROR') {
          (req.session as any).flash = {
            type: 'error',
            message: 'OpenAI is not configured. Please check your API key.',
          };
          return res.redirect('/ai-insights');
        }
      }

      (req.session as any).flash = {
        type: 'error',
        message: 'Failed to generate insights. Please try again.',
      };

      res.redirect('/ai-insights');
    }
  }

  /**
   * POST /ai-insights/:id/dismiss
   * Dismiss an insight and redirect
   */
  private async dismiss(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.redirect('/auth/login');
      }

      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid insight ID', 400);
      }

      await this.aiInsightService.dismiss(id, userId);

      (req.session as any).flash = {
        type: 'success',
        message: 'Insight dismissed.',
      };

      res.redirect('/ai-insights');
    } catch (err) {
      if (err instanceof AppError && err.code === 'NOT_FOUND') {
        (req.session as any).flash = {
          type: 'error',
          message: 'Insight not found.',
        };
        return res.redirect('/ai-insights');
      }

      (req.session as any).flash = {
        type: 'error',
        message: 'Failed to dismiss insight. Please try again.',
      };

      res.redirect('/ai-insights');
    }
  }

  /**
   * Format date as time ago string (e.g., "2 hours ago")
   */
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
  }
}
