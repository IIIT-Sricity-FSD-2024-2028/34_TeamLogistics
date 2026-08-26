(function () {
  'use strict';

  function resolveLogoSrc() {
    var path = window.location.pathname.replace(/\\/g, '/');
    var inSubDir = /\/(driver|superuser|fleet-manager|business-client|portals)\//i.test(path);
    return inSubDir ? '../assets/fleet-logo-icon.png' : 'assets/fleet-logo-icon.png';
  }

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

  function init() {
    var containers = document.querySelectorAll('.ds-brand-logo');
    for (var i = 0; i < containers.length; i++) {
      renderLogo(containers[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DeliverSyncBrand = {
    init: init,
    render: renderLogo,
    html: logoHTML
  };
})();
