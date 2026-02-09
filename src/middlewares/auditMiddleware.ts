import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/AuditService';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function createAuditMiddleware(auditService: AuditService) {
  return function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
    const originalJson = res.json.bind(res);
    // Capture these before routing modifies req.path and before session is destroyed
    const requestPath = req.originalUrl.split('?')[0];
    const requestMethod = req.method;
    const sessionUserId = req.session?.userId || null;
    const ip = getClientIp(req);

    res.json = function (body: Record<string, unknown>) {
      const logPromises: Promise<unknown>[] = [];

      // Auth events
      if (requestPath === '/api/auth/login' && requestMethod === 'POST') {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const userData = body?.data as Record<string, unknown> | undefined;
          logPromises.push(auditService.logAction({
            userId: (userData?.id as string) || null,
            action: 'user.login',
            entityType: 'user',
            entityId: (userData?.id as string) || undefined,
            details: JSON.stringify({ email: userData?.email }),
            ipAddress: ip,
          }));
        } else {
          const reqBody = req.body as Record<string, unknown> | undefined;
          logPromises.push(auditService.logAction({
            userId: null,
            action: 'user.login_failed',
            details: JSON.stringify({ email: reqBody?.email }),
            ipAddress: ip,
          }));
        }
      }

      if (requestPath === '/api/auth/logout' && requestMethod === 'POST') {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logPromises.push(auditService.logAction({
            userId: sessionUserId,
            action: 'user.logout',
            entityType: 'user',
            entityId: sessionUserId || undefined,
            ipAddress: ip,
          }));
        }
      }

      if (requestPath === '/api/auth/register' && requestMethod === 'POST') {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const userData = body?.data as Record<string, unknown> | undefined;
          logPromises.push(auditService.logAction({
            userId: (userData?.id as string) || null,
            action: 'user.register',
            entityType: 'user',
            entityId: (userData?.id as string) || undefined,
            ipAddress: ip,
          }));
        }
      }

      if (logPromises.length > 0) {
        Promise.all(logPromises).finally(() => originalJson(body));
        return res;
      }

      return originalJson(body);
    } as Response['json'];

    next();
  };
}
