import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { authService } from '../services/authService';
import { userRepository } from '../repositories/userRepository';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const register = asyncHandler(async (req, res: Response) => {
  const body = registerSchema.parse(req.body);
  const result = await authService.register(body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req, res: Response) => {
  const body = loginSchema.parse(req.body);
  const result = await authService.login(body);
  res.json(result);
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userRepository.findById(req.user!.id);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  res.json({ user: user.toJSON() });
});
