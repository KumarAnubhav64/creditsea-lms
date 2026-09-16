import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { MongoError } from 'mongodb';

interface ErrorWithStatus extends Error {
  statusCode?: number;
  failures?: Array<{ rule: string; message: string }>;
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Route not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let failures: Array<{ rule: string; message: string }> | undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    failures = err.failures;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues[0]?.message ?? 'Invalid request body';
  } else if (typeof err === 'object' && err !== null) {
    const e = err as ErrorWithStatus & { code?: number; name?: string };
    if (e.statusCode) {
      statusCode = e.statusCode;
      message = e.message;
    } else if (e.name === 'ValidationError') {
      statusCode = 400;
      const validationErr = err as Error & { errors: Record<string, { message: string }> };
      message = Object.values(validationErr.errors)
        .map((v) => v.message)
        .join('; ');
    } else if ((err as MongoError).code === 11000) {
      statusCode = 409;
      const mongoErr = err as MongoError & { keyValue?: Record<string, unknown> };
      const field = Object.keys(mongoErr.keyValue ?? {})[0];
      message = field === 'utr' ? 'UTR already recorded' : `Duplicate value for unique field: ${field ?? 'unknown'}`;
    } else if (e.name === 'MulterError') {
      if (e.message === 'File too large') {
        statusCode = 413;
        message = 'File exceeds the 5 MB limit';
      } else {
        statusCode = 400;
        message = e.message;
      }
    } else if (process.env.NODE_ENV !== 'production') {
      message = e.message ?? message;
    }
  }

  res.status(statusCode).json({ message, ...(failures ? { failures } : {}) });
}
