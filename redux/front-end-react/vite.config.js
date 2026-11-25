import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001'

function productionCsp(mode) {
  const api = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL || '';
  const apiOrigin = /^https?:\/\//i.test(api) ? new URL(api).origin : '';
  const policy = [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com", "img-src 'self' data: blob:", "frame-src 'self' blob: https://www.openstreetmap.org",
    "connect-src 'self' " + apiOrigin, "object-src 'none'", "base-uri 'self'", "form-action 'self'"
  ].join('; ');
  return {name: 'portal-csp', apply: 'build', transformIndexHtml() {
    return [{tag:'meta',attrs:{'http-equiv':'Content-Security-Policy',content:policy},injectTo:'head-prepend'}];
  }};
}

export default defineConfig(({mode}) => ({
  plugins: [react(), productionCsp(mode)],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
}))
