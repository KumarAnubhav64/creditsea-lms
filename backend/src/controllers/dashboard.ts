import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { dashboardService } from '../services/dashboardService';
import { asyncHandler } from '../utils/asyncHandler';

export const leads = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const data = await dashboardService.leads();
  res.json(data);
});

export const pendingSanction = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const data = await dashboardService.pendingSanction();
  res.json(data);
});

export const pendingDisbursement = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const data = await dashboardService.pendingDisbursement();
  res.json(data);
});

export const pendingCollection = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const data = await dashboardService.pendingCollection();
  res.json(data);
});

export const allLoans = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const data = await dashboardService.allLoans(status);
  res.json(data);
});
