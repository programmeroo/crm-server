import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AuditService } from '../services/AuditService';
import { AppError } from '../errors/AppError';

const querySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  action: Joi.string().optional(),
  entityType: Joi.string().optional(),
  userId: Joi.number().integer().optional(),
});

export class AuditController {
  public router: Router;

  constructor(private auditService: AuditService) {
    this.router = Router();
    this.router.get('/', this.getLogs.bind(this));
  }

  private async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!(req.session as any)?.userId) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      const { error, value } = querySchema.validate(req.query);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const logs = await this.auditService.getLogs({
        limit: value.limit,
        offset: value.offset,
        action: value.action,
        entityType: value.entityType,
        userId: value.userId || (req.session as any).userId,
      });

      res.json({ data: logs, error: null });
    } catch (err) {
      next(err);
    }
  }
}
