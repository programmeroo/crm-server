import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

export function createApiKeyAuth(authService: AuthService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['x-api-key'] as string | undefined;

    if (!key) {
      // No API key header — fall through to session auth
      next();
      return;
    }

    try {
      const { user, scopes } = await authService.validateApiKey(key);
      (req as any).apiUser = user;
      (req as any).apiScopes = scopes;
      next();
    } catch (err) {
      next(err);
    }
  };
}
