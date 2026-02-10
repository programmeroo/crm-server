import { User } from '../entities/User.entity';

declare global {
  namespace Express {
    interface Request {
      apiUser?: User;
      apiScopes?: string[];
    }
  }
}

export { }; // Ensure it's treated as a module
