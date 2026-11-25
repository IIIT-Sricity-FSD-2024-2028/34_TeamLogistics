import { useEffect } from 'react';

// The original app only loaded the CSS relevant to whichever portal a page
// belonged to (plus brand-logo.css + styles.css shared globally). This hook
// reproduces that scoping so portal stylesheets don't collide with each other.
//
// Stylesheets are reference-counted across mounts so that navigating between
// two pages that need the same files (e.g. Home -> About, both loading
// styles.css + brand-logo.css) never removes and re-inserts the <link> tag —
// that removal/reinsertion is what caused a visible flash of unstyled content
// during navigation, made worse by React's dev-mode double-invoked effects.
// Removal on genuine unmount is debounced briefly so a fast unmount+remount
// (StrictMode, or navigating quickly) reuses the existing link instead of
// tearing it down and rebuilding it.

const registry = new Map();

function acquire(href, portalStyle) {
  const entry = registry.get(href);
  if (entry) {
    if (entry.removalTimer) {
      clearTimeout(entry.removalTimer);
      entry.removalTimer = null;
    }
    entry.count += 1;
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.portalStyle = portalStyle;
  document.head.appendChild(link);
  registry.set(href, { link, count: 1, removalTimer: null });
}

function release(href) {
  const entry = registry.get(href);
  if (!entry) return;

  entry.count -= 1;
  if (entry.count > 0) return;

  entry.removalTimer = setTimeout(() => {
    const current = registry.get(href);
    if (current && current.count <= 0) {
      current.link.remove();
      registry.delete(href);
    }
  }, 60);
}

export function usePortalStyles(files) {
  useEffect(() => {
    const hrefs = files.map((file) => `/assets/css/${file}`);
    hrefs.forEach((href, i) => acquire(href, files[i]));

    return () => {
      hrefs.forEach((href) => release(href));
    };
  }, [files.join(',')]);
}
