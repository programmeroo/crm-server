import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export function requireLogin(req: Request, _res: Response, next: NextFunction): void {
  if (!(req.session as any).userId) {
    next(new AppError('UNAUTHORIZED', 'Login required', 401));
    return;
  }
  next();
}
