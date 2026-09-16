import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
// Factor III — the upload cap is deployment config, not hardcoded policy.
const MAX_FILE_SIZE = env.maxFileSizeMb * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new ApiError(415, `Unsupported file type "${ext}". Allowed: PDF, JPG, PNG`));
    return;
  }
  cb(null, true);
};

export const salarySlipUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

export const MAX_FILE_SIZE_LABEL = `${env.maxFileSizeMb} MB`;
