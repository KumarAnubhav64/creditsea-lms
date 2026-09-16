import { Response, NextFunction } from 'express';
import { Role } from '../models/User';
import { AuthRequest } from './auth';
import { ApiError } from '../utils/ApiError';

export function requireRole(...allowed: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(ApiError.forbidden(`This action requires one of roles: ${allowed.join(', ')}`));
      return;
    }
    next();
  };
}
