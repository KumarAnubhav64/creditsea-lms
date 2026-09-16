import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { borrowerService } from '../services/borrowerService';
import { loanService } from '../services/loanService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const getStage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await borrowerService.getStage(req.user!.id);
  res.json(result);
});

export const updateDetails = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await borrowerService.updateDetails(req.user!.id, req.body);
  res.json({ user });
});

export const uploadSalarySlip = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded - attach a PDF/JPG/PNG file in the "file" field');
  }
  const user = await borrowerService.attachSalarySlip(req.user!.id, req.file.filename);
  res.json({ user });
});

export const updateLoanConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    amount: z.coerce.number(),
    tenureDays: z.coerce.number(),
  });
  const body = schema.parse(req.body);
  const user = await borrowerService.updateLoanConfig(req.user!.id, body);
  res.json({ user });
});

const applySchema = z.object({
  amount: z.coerce.number().optional(),
  tenureDays: z.coerce.number().optional(),
});

export const applyLoan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = applySchema.parse(req.body);
  const loan = await borrowerService.applyForLoan(req.user!.id, body);
  res.status(201).json({ loan });
});

export const myLoans = asyncHandler(async (req: AuthRequest, res: Response) => {
  const loans = await borrowerService.myLoans(req.user!.id);
  res.json({ loans });
});

const paymentSchema = z.object({
  utr: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentDate: z.coerce.date(),
});

export const recordPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = paymentSchema.parse(req.body);
  const result = await loanService.recordPayment(req.user!.id, req.params.id, body);
  res.status(201).json(result);
});
