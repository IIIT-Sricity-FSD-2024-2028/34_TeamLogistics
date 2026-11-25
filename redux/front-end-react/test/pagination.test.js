import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

test('shared pagination limits long lists and reports the current result range', async (t) => {
  const vite = await createServer({
    configFile: false,
    plugins: [react()],
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  });
  t.after(() => vite.close());

  const { default: Pagination, usePagination } = await vite.ssrLoadModule('/src/components/Pagination.jsx');
  const records = Array.from({ length: 9 }, (_, index) => `Record ${index + 1}`);

  function Harness() {
    const pages = usePagination(records);
    return h('div', null,
      ...pages.pageItems.map((record) => h('span', { key: record }, record)),
      h(Pagination, { ...pages, onPageChange: pages.setPage, itemLabel: 'records' }),
    );
  }

  const html = renderToString(h(Harness)).replaceAll('<!-- -->', '');
  assert.match(html, /Record 1/);
  assert.match(html, /Record 8/);
  assert.doesNotMatch(html, /Record 9/);
  assert.match(html, /Showing 1–8 of 9 records/);
  assert.match(html, /Page 1 of 2/);
});
