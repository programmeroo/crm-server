import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AuthService } from '../services/AuthService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

const createKeySchema = Joi.object({
  description: Joi.string().required(),
  scopes: Joi.array().items(Joi.string()).min(1).required(),
  expiresInDays: Joi.number().integer().positive().optional(),
});

export class AuthController {
  public router: Router;

  constructor(private authService: AuthService) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post('/login', this.login.bind(this));
    this.router.post('/logout', this.logout.bind(this));
    this.router.get('/me', requireLogin, this.me.bind(this));
    this.router.post('/keys', requireLogin, this.createKey.bind(this));
    this.router.get('/keys', requireLogin, this.listKeys.bind(this));
    this.router.delete('/keys/:id', requireLogin, this.revokeKey.bind(this));
  }

  private async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const user = await this.authService.login(value.email, value.password);

      req.session.userId = user.id;

      res.json({
        data: { id: user.id, email: user.email, name: user.name },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  private async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      res.json({ data: { message: 'Logged out' }, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.authService.findById(req.session.userId!);
      if (!user) {
        throw new AppError('NOT_FOUND', 'User not found', 404);
      }
      res.json({
        data: { id: user.id, email: user.email, name: user.name },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  private async createKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = createKeySchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const { apiKey, rawKey } = await this.authService.generateApiKey(
        req.session.userId!,
        value.description,
        value.scopes,
        value.expiresInDays
      );

      res.status(201).json({
        data: {
          id: apiKey.id,
          key: rawKey,
          description: apiKey.description,
          scopes: JSON.parse(apiKey.scopes),
          expires_at: apiKey.expires_at,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  private async listKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const keys = await this.authService.listApiKeys(req.session.userId!);
      res.json({
        data: keys.map((k) => ({
          id: k.id,
          description: k.description,
          scopes: JSON.parse(k.scopes),
          is_active: k.is_active === 1,
          created_at: k.created_at,
          expires_at: k.expires_at,
        })),
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  private async revokeKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authService.revokeApiKey(req.params.id as string, req.session.userId!);
      res.json({ data: { message: 'API key revoked' }, error: null });
    } catch (err) {
      next(err);
    }
  }
}
