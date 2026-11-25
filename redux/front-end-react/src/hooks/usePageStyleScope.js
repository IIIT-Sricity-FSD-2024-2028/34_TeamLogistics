import { useInsertionEffect } from 'react';

const activeScopes = new Map();

function syncBodyScopes() {
  if (activeScopes.size === 0) {
    delete document.body.dataset.pageStyleScopes;
    return;
  }

  document.body.dataset.pageStyleScopes = [...activeScopes.keys()].sort().join(' ');
}

export function usePageStyleScope(scope) {
  useInsertionEffect(() => {
    if (typeof document === 'undefined') return undefined;

    activeScopes.set(scope, (activeScopes.get(scope) || 0) + 1);
    syncBodyScopes();

    return () => {
      const nextCount = (activeScopes.get(scope) || 1) - 1;
      if (nextCount > 0) activeScopes.set(scope, nextCount);
      else activeScopes.delete(scope);
      syncBodyScopes();
    };
  }, [scope]);
}
