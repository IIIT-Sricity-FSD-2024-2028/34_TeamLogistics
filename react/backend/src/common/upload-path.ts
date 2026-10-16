import * as path from 'path';

export function getUploadRoot(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, '..', '..', 'uploads');
}

export function getDocumentUploadDirectory(): string {
  return path.join(getUploadRoot(), 'documents');
}
