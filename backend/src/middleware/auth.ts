import { Request, Response, NextFunction } from 'express';
import { User, UserDoc } from '../models/User';
import { verifyToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';

export interface AuthRequest extends Request {
  user?: UserDoc;
}

export async function auth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or malformed Authorization header');
    }
    const token = header.slice('Bearer '.length);
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw ApiError.unauthorized('Account no longer exists');
    }

    // ADR-002: the DB role is authoritative; a stale token cannot keep old privileges.
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
