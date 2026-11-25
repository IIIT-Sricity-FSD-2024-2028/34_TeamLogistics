import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function acquireWriterLock(directory: string): () => void {
  const absolute = path.resolve(directory);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const canonical = fs.existsSync(absolute) ? fs.realpathSync(absolute) : absolute;
  const lock = canonical + '.writer-lock';
  const owner = JSON.stringify({ pid: process.pid, instance: randomUUID() });
  try {
    fs.writeFileSync(lock, owner, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    throw new Error('JSON writer lock exists at ' + lock + '. Check the process recorded there before recovery.');
  }
  return () => {
    if (fs.existsSync(lock) && fs.readFileSync(lock, 'utf8') === owner) fs.unlinkSync(lock);
  };
}
