import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = path.resolve(__dirname, '..', '..', 'logs');

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function dateStamp(): string {
  return new Date().toISOString().split('T')[0];
}

function appendLine(filename: string, entry: Record<string, unknown>): void {
  ensureLogsDir();
  fs.appendFileSync(path.join(LOGS_DIR, filename), JSON.stringify(entry) + '\n', 'utf-8');
}

export function logAccess(entry: Record<string, unknown>): void {
  appendLine(`access-${dateStamp()}.log`, entry);
}

export function logAudit(entry: Record<string, unknown>): void {
  appendLine(`audit-${dateStamp()}.log`, entry);
}

export function logError(entry: Record<string, unknown>): void {
  appendLine(`error-${dateStamp()}.log`, entry);
}

export function getLogsDir(): string {
  return LOGS_DIR;
}

const RETENTION_DAYS = 14;
const MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function cleanupOldLogs(): void {
  ensureLogsDir();
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const file of fs.readdirSync(LOGS_DIR)) {
    const filePath = path.join(LOGS_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile() && stats.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
    }
  }
}

export function startLogMaintenance(): void {
  cleanupOldLogs();
  setInterval(cleanupOldLogs, MAINTENANCE_INTERVAL_MS).unref();
}
