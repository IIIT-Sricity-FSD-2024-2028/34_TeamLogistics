/**
 * DeliverSync Brand Logo Component
 * Single source of truth for the DeliverSync logo across ALL portals.
 *
 * Brand Rules:
 *   App Name : DeliverSync
 *   "Deliver" → #FFFFFF (white)
 *   "Sync"    → #FFD60A (yellow)
 *   Logo icon: assets/fleet-logo-icon.png
 *
 * Usage:
 *   <div class="ds-brand-logo" data-href="dashboard.html" data-sub="Fleet Manager Portal"></div>
 *   Then call: DeliverSyncBrand.init()   or it auto-inits on DOMContentLoaded.
 *
 *   data-href  – optional link target (defaults to index page)
 *   data-sub   – optional subtitle line (e.g. "Fleet Manager Portal")
 *   data-size  – "sm" | "md" | "lg"  (default "md")
 */
(function () {
  'use strict';

  /* ── Resolve correct path to the logo image ── */
  function resolveLogoSrc() {
    // If we are inside a portal sub-folder (driver/, superuser/, etc.) the
    // assets live one level up.  Detect by checking if the current page is
    // inside a known sub-directory.
    var path = window.location.pathname.replace(/\\/g, '/');
    var inSubDir = /\/(driver|superuser|fleet-manager|business-client|portals)\//i.test(path);
    return inSubDir ? '../assets/fleet-logo-icon.png' : 'assets/fleet-logo-icon.png';
  }

  /* ── Render a single logo element ── */
  function renderLogo(container) {
    var href = container.getAttribute('data-href') || '#';
    var subtitle = container.getAttribute('data-sub') || '';
    var size = container.getAttribute('data-size') || 'md';

    var imgSrc = resolveLogoSrc();

    var html =
      '<a class="ds-brand-link ds-brand-' + size + '" href="' + href + '">' +
        '<div class="ds-brand-icon"><img src="' + imgSrc + '" alt="DeliverSync Logo"></div>' +
        '<div class="ds-brand-text">' +
          '<span class="ds-brand-word"><span class="ds-deliver">Deliver</span><span class="ds-sync">Sync</span></span>' +
          (subtitle ? '<span class="ds-brand-sub">' + subtitle + '</span>' : '') +
        '</div>' +
      '</a>';

    container.innerHTML = html;
  }

  /* ── Returns raw HTML string (for JS-rendered portals like superuser) ── */
  function logoHTML(href, subtitle, size) {
    href = href || '#';
    subtitle = subtitle || '';
    size = size || 'md';

    var imgSrc = resolveLogoSrc();

    return (
      '<a class="ds-brand-link ds-brand-' + size + '" href="' + href + '">' +
        '<div class="ds-brand-icon"><img src="' + imgSrc + '" alt="DeliverSync Logo"></div>' +
        '<div class="ds-brand-text">' +
          '<span class="ds-brand-word"><span class="ds-deliver">Deliver</span><span class="ds-sync">Sync</span></span>' +
          (subtitle ? '<span class="ds-brand-sub">' + subtitle + '</span>' : '') +
        '</div>' +
      '</a>'
    );
  }

  /* ── Auto-init all placeholder divs ── */
  function init() {
    var containers = document.querySelectorAll('.ds-brand-logo');
    for (var i = 0; i < containers.length; i++) {
      renderLogo(containers[i]);
    }
  }

  // Auto-run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose globally so JS-rendered portals can call it
  window.DeliverSyncBrand = {
    init: init,
    render: renderLogo,
    html: logoHTML
  };
})();
