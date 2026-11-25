import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5184', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: [
    {command: 'node e2e/backend.cjs', url: 'http://127.0.0.1:3184/api/health/ready', reuseExistingServer: false},
    {command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5184 --strictPort', url: 'http://127.0.0.1:5184', reuseExistingServer: false,
      env: {VITE_API_PROXY_TARGET: 'http://127.0.0.1:3184'}},
  ],
});
