import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { loanService } from '../services/loanService';
import { asyncHandler } from '../utils/asyncHandler';

const decisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().min(5).max(300).optional(),
});

const paymentSchema = z.object({
  utr: z.string().trim().min(6, 'UTR must be at least 6 characters').max(30).transform((s) => s.toUpperCase()),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.coerce.date(),
});

export const listLoans = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = String(req.query.status ?? '');
  const loans = await loanService.listByStatus({ id: req.user!.id, role: req.user!.role }, status as never);
  res.json({ loans });
});

export const getLoan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const loan = await loanService.getById({ id: req.user!.id, role: req.user!.role }, req.params.id);
  res.json({ loan });
});

export const decide = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = decisionSchema.parse(req.body);
  const loan = await loanService.decide(req.user!.id, req.params.id, body);
  res.json({ loan });
});

export const disburse = asyncHandler(async (req: AuthRequest, res: Response) => {
  const loan = await loanService.disburse(req.user!.id, req.params.id);
  res.json({ loan });
});

export const recordPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = paymentSchema.parse(req.body);
  const result = await loanService.recordPayment(req.user!.id, req.params.id, body);
  res.status(201).json(result);
});
