import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';

// ClamAV accepts the file on stdin. No client filenames are passed to a shell.
export async function scanUpload(buffer: Buffer) {
  const executable = process.env.CLAMSCAN_PATH;
  if (!executable) {
    if (process.env.NODE_ENV === 'production') throw new ServiceUnavailableException('File scanning is unavailable');
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, ['--no-summary', '-'], {stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true});
    const unavailable = () => reject(new ServiceUnavailableException('File scanning is unavailable'));
    const timer = setTimeout(() => { child.kill(); unavailable(); }, 30000);
    child.once('error', () => { clearTimeout(timer); unavailable(); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else if (code === 1) reject(new BadRequestException('File rejected by malware scanner'));
      else unavailable();
    });
    child.stdin.on('error', () => {}); // Process exit determines the scan result.
    child.stdin.end(buffer);
  });
}
