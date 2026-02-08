import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      apiUser?: import('../entities/User.entity').User;
      apiScopes?: string[];
    }
  }
}
