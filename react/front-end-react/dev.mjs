import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(frontendDir, '..', 'backend');
const nestCli = path.join(backendDir, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
const viteCli = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');
const apiUrl = 'http://127.0.0.1:3001/api/changes';
const children = new Set();
let stopping = false;
let backendProcess = null;
let frontendProcess = null;

function startNode(script, args, cwd) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
  });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  child.kill('SIGTERM');
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) stopProcess(child);
  process.exit(code);
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function isApiReady() {
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(1000) });
    await response.body?.cancel();
    return response.status === 200 || response.status === 401;
  } catch {
    return false;
  }
}

async function waitForApi(child, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited with code ${child.exitCode}.`);
    }
    if (await isApiReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Backend did not become ready on port 3001 within 60 seconds.');
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

try {
  if (await isApiReady()) {
    console.log('Backend is already running on http://127.0.0.1:3001');
  } else {
    if (await isPortOpen(3001)) {
      throw new Error('Port 3001 is occupied by another service. Stop it before starting DeliverSync.');
    }

    console.log('Starting DeliverSync backend...');
    backendProcess = startNode(nestCli, ['start', '--watch'], backendDir);
    await waitForApi(backendProcess);
    console.log('Backend is ready. Starting Vite...');
  }

  const forwardedArgs = process.argv.slice(2);
  frontendProcess = startNode(viteCli, forwardedArgs, frontendDir);

  frontendProcess.once('exit', (code) => shutdown(code ?? 0));
  backendProcess?.once('exit', (code) => {
    if (stopping) return;
    console.error(`Backend stopped unexpectedly with code ${code ?? 1}.`);
    shutdown(code || 1);
  });
} catch (error) {
  console.error(error.message);
  shutdown(1);
}
