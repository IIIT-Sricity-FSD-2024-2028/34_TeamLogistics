import { writeStagedUpload } from './upload-journal';
import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { memoryStorage } from 'multer';
import { scanUpload } from './scan-upload';
import * as path from 'path';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.csv'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const DocumentUpload = FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 16, fieldSize: 4096 },
      fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(extension)) {
          cb(new BadRequestException('Only PDF, CSV, PNG, and JPG files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    });

export async function stageDocument(file: Express.Multer.File) {
  await scanUpload(file.buffer);
  file.filename = randomUUID() + path.extname(file.originalname).toLowerCase();
  file.path = writeStagedUpload(file.filename, file.buffer);
}

