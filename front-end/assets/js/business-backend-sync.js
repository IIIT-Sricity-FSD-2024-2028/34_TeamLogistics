(function () {
  const D = window.DeliverySyncAPI;

  const $ = (sel, root = document) => root.querySelector(sel);

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function isActiveStatus(status) {
    const s = String(status || '').toLowerCase();

    return (
      s.includes('active') ||
      s.includes('progress') ||
      s.includes('transit') ||
      s.includes('pickup') ||
      s.includes('picked') ||
      s.includes('preparing') ||
      s.includes('assigned') ||
      s.includes('pending')
    );
  }

  function isCompletedStatus(status) {
    const s = String(status || '').toLowerCase();
    return s.includes('completed') || s.includes('delivered');
  }

  function pillClass(status) {
    const s = String(status || '').toLowerCase();

    if (s.includes('completed') || s.includes('delivered')) return 'bright';
    if (s.includes('transit') || s.includes('pickup') || s.includes('preparing')) return 'bright';
    if (s.includes('blocked') || s.includes('cancelled') || s.includes('cancel')) return 'danger';

    return 'bright';
  }

  function amountNumber(value) {
    return Number(String(value || 0).replace(/[^\d.]/g, '')) || 0;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function toast(message) {
    const t = document.createElement('div');

    t.textContent = message;
    t.style.cssText =
      'position:fixed;top:24px;right:24px;background:#1e1e2f;color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.4);border-left:4px solid #facc15';

    document.body.appendChild(t);

    setTimeout(function () {
      t.remove();
    }, 2800);
  }

  function setError(input, message) {
    if (!input) return;

    let err = input.parentElement.querySelector('.inline-error');

    if (!err) {
      err = document.createElement('div');
      err.className = 'inline-error';
      err.style.cssText = 'color:#ff6b6b;font-size:13px;margin-top:6px;';
      input.parentElement.appendChild(err);
    }

    err.textContent = message || '';
  }

  function clearErrors() {
    document.querySelectorAll('.inline-error').forEach(function (el) {
      el.textContent = '';
    });
  }

  async function renderBusinessDashboard() {
    if (!D || !D.Deliveries) {
      console.error('DeliverySyncAPI.Deliveries not available');
      return;
    }

    try {
      const [deliveries, invoices] = await Promise.all([
        D.Deliveries.getAll(),
        D.Transactions && D.Transactions.getInvoices
          ? D.Transactions.getInvoices()
          : Promise.resolve([])
      ]);

      const allDeliveries = deliveries || [];

      const activeDeliveries = allDeliveries.filter(function (d) {
        return isActiveStatus(d.status);
      });

      const completedDeliveries = allDeliveries.filter(function (d) {
        return isCompletedStatus(d.status);
      });

      const unpaidInvoices = (invoices || []).filter(function (inv) {
        const s = String(inv.status || '').toLowerCase();
        return s.includes('unpaid') || s.includes('pending');
      });

      const unpaidAmount = unpaidInvoices.reduce(function (sum, inv) {
        return sum + amountNumber(inv.amount || inv.total);
      }, 0);

      setText('bc-stat-total-deliveries', allDeliveries.length);
      setText('bc-stat-active-deliveries', activeDeliveries.length);
      setText('bc-stat-completed-deliveries', completedDeliveries.length);
      setText('bc-stat-unpaid-invoices', unpaidInvoices.length);
      setText('bc-stat-unpaid-foot', `₹${unpaidAmount} Due`);

      const heroSubtitle = document.querySelector('.hero-card .page-subtitle');
      if (heroSubtitle) {
        heroSubtitle.textContent = `Your logistics command center. ${activeDeliveries.length} active deliveries in progress.`;
      }

      const tbody = document.getElementById('bc-dashboard-active-tbody');

      if (tbody) {
        tbody.innerHTML =
          activeDeliveries.map(function (d) {
            const id = d.id || d.deliveryId || '--';
            const customer = d.customer || d.client || d.clientName || d.businessName || '--';
            const pickup = d.pickup || d.pickupAddress || d.source || '--';
           const destination = d.dropoff || d.destination || d.drop || d.dropAddress || '--';
            const status = d.status || '--';
            const driver = d.driver || d.assignedDriver || '--';
            const eta = d.eta || d.expectedTime || d.time || '--';

            return `
              <tr>
                <td>${esc(id)}</td>
                <td>${esc(customer)}</td>
                <td>
                  <div>
                    <svg viewBox="0 0 24 24">
                      <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"></path>
                      <circle cx="12" cy="10" r="2"></circle>
                    </svg>
                    ${esc(pickup)}
                  </div>
                  <div class="muted">${esc(destination)}</div>
                </td>
                <td>
                  <span class="pill ${pillClass(status)}">${esc(status)}</span>
                </td>
                <td>${esc(driver)}</td>
                <td>
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 7v5l3 2"></path>
                  </svg>
                  ${esc(eta)}
                </td>
                <td>
                  <a class="btn sm outline-yellow" href="live-tracking.html?id=${encodeURIComponent(id)}">Track</a>
                </td>
              </tr>
            `;
          }).join('') || `
            <tr>
              <td colspan="7" style="text-align:center;color:#8f8f8f;padding:18px">
                No active deliveries found.
              </td>
            </tr>
          `;
      }

    } catch (error) {
      console.error('Failed to sync business dashboard:', error);
    }
  }

  function bindCreateDeliveryPage() {
    const form = document.getElementById('bc-create-form');

    const pickupInput = document.getElementById('pickupLocation');
    const dropInput = document.getElementById('dropLocation');
    const packageInput = document.getElementById('packageDetails');

    const fileInput = document.getElementById('delivery-list-upload');
    const fileName = document.getElementById('delivery-list-file-name');

    const dateInput = document.getElementById('preferredDate');
    const timeInput = document.getElementById('preferredTime');
    const instructionsInput = document.getElementById('deliveryInstructions');

    const typeInput = document.getElementById('delivery-type-input');
    const typeCards = Array.from(document.querySelectorAll('.option-card[data-delivery-type]'));

    if (!form) return;

    typeCards.forEach(function (card) {
      card.addEventListener('click', function () {
        typeCards.forEach(function (c) {
          c.classList.remove('selected');
        });

        card.classList.add('selected');

        if (typeInput) {
          typeInput.value = card.dataset.deliveryType || 'standard';
        }
      });
    });

    if (fileInput && fileName) {
      fileInput.addEventListener('change', function () {
        fileName.textContent = fileInput.files[0] ? fileInput.files[0].name : 'No file selected';
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors();

      const pickup = pickupInput ? pickupInput.value.trim() : '';
      const destination = dropInput ? dropInput.value.trim() : '';
      const packageDetails = packageInput ? packageInput.value.trim() : '';

      const deliveryType = typeInput ? typeInput.value : 'standard';

      const selectedCard = document.querySelector('.option-card.selected');
      const amount = Number(selectedCard?.dataset.price || 40);

      const file = fileInput && fileInput.files ? fileInput.files[0] : null;

      const preferredDate = dateInput ? dateInput.value : '';
      const preferredTime = timeInput ? timeInput.value : '';
      const instructions = instructionsInput ? instructionsInput.value.trim() : '';

      let valid = true;

      if (!pickup) {
        setError(pickupInput, 'Pickup location is required');
        valid = false;
      }

      if (!destination) {
        setError(dropInput, 'Drop location is required');
        valid = false;
      }

      if (!packageDetails) {
        setError(packageInput, 'Package details are required');
        valid = false;
      }

      if (file) {
        const ext = file.name.split('.').pop().toLowerCase();

        if (!['pdf', 'csv'].includes(ext)) {
          toast('Only PDF or CSV files are allowed');
          valid = false;
        }
      }

      if (!valid) return;

      if (!D || !D.Deliveries || !D.Deliveries.create) {
        toast('Deliveries API is not available.');
        return;
      }

   const payload = {
  customer: 'Acme Logistics Inc.',
  pickup: pickup,
  dropoff: destination,
  package: packageDetails,
  type: deliveryType === 'express' ? 'Express' : 'Standard',
  priority: deliveryType === 'express' ? 'High' : 'Medium',
  items: 1,
  instructions: instructions || ''
};
      try {
        await D.Deliveries.create(payload);

        toast('Delivery created successfully');

        setTimeout(function () {
          window.location.href = 'active-deliveries.html';
        }, 700);

      } catch (error) {
        console.error('Failed to create delivery:', error);
        toast('Failed to create delivery from backend');
      }
    });
  }

  async function renderActiveDeliveriesPage() {
    const root = document.querySelector('.bc-content');
    if (!root) return;

    if (!D || !D.Deliveries || !D.Deliveries.getAll) {
      root.innerHTML = `
        <div class="card" style="padding:24px;color:#ff8d8d">
          Deliveries API is not available.
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="card" style="padding:24px;color:#8f8f8f;text-align:center">
        Loading active deliveries from backend...
      </div>
    `;

    function getEta(delivery) {
      return delivery.eta || delivery.expectedTime || delivery.preferredTime || '--';
    }

    function deliveryCard(d) {
      const id = d.id || d.deliveryId || '--';
      const pickup = d.pickup || d.pickupAddress || d.source || '--';
      const destination = d.dropoff || d.destination || d.drop || d.dropAddress || '--';
      const driver = d.driver || d.assignedDriver || '--';
      const eta = getEta(d);
      const status = d.status || 'Pending';             

      return `
        <div class="active-delivery-card" data-id="${esc(id)}">
          <div class="delivery-id-block">
            <h2>#${esc(id)}</h2>
            <span class="pill bright">${esc(status).toUpperCase()}</span>
          </div>

          <div class="delivery-location">
            <div class="label">FROM</div>
            <div class="value">${esc(pickup)}</div>
          </div>

          <div class="delivery-location">
            <div class="label">TO</div>
            <div class="value">${esc(destination)}</div>
          </div>

          <div class="delivery-driver">
            <div class="label">DRIVER</div>
            <div class="value">${esc(driver)}</div>
            <div class="muted">${esc(d.driverDistance || '--')}</div>
          </div>

          <div class="delivery-eta">
            <div class="label">ETA</div>
            <div class="eta-big">${esc(eta)}</div>
            <div class="muted">${String(eta).includes(':') ? '' : 'mins'}</div>
          </div>

          <div class="delivery-actions">
            <a class="btn yellow" href="live-tracking.html?id=${encodeURIComponent(id)}">
              Track Live
            </a>

            <button class="btn danger-outline bc-cancel-delivery" data-id="${esc(id)}" type="button">
              × Cancel Order
            </button>
          </div>
        </div>
      `;
    }

    try {
      const deliveries = await D.Deliveries.getAll();

      const activeDeliveries = (deliveries || []).filter(function (d) {
        return isActiveStatus(d.status);
      });

      root.innerHTML = `
        <style>
          .active-page-head {
            display:flex;
            align-items:flex-end;
            justify-content:space-between;
            gap:18px;
            margin-bottom:20px;
          }

          .active-title h1 {
            margin:0;
            font-size:44px;
            color:#fff;
            font-weight:900;
            letter-spacing:-1px;
          }

          .active-title p {
            margin:8px 0 0;
            color:#a7a7a7;
            font-size:17px;
          }

          .active-search {
            width:320px;
            max-width:100%;
            display:flex;
            align-items:center;
            gap:10px;
            background:#111827;
            border:1px solid #263041;
            border-radius:18px;
            padding:14px 18px;
          }

          .active-search input {
            width:100%;
            border:0;
            outline:0;
            background:transparent;
            color:#fff;
            font:inherit;
          }

          .active-delivery-list {
            display:flex;
            flex-direction:column;
            gap:18px;
          }

          .active-delivery-card {
            display:grid;
            grid-template-columns:1.1fr 1fr 1fr 1fr .7fr 1.25fr;
            gap:22px;
            align-items:center;
            padding:26px 28px;
            border-radius:22px;
            border:1px solid #252525;
            background:linear-gradient(135deg,#191919,#121212);
            box-shadow:0 14px 30px rgba(0,0,0,.24);
          }

          .delivery-id-block h2 {
            margin:0 0 12px;
            color:#fff;
            font-size:28px;
            font-weight:900;
          }

          .label {
            color:#9ca3af;
            font-size:12px;
            font-weight:800;
            letter-spacing:.08em;
            margin-bottom:8px;
          }

          .value {
            color:#fff;
            font-size:18px;
            font-weight:700;
            line-height:1.35;
          }

          .eta-big {
            color:#fff;
            font-size:52px;
            font-weight:900;
            line-height:.9;
          }

          .delivery-actions {
            display:flex;
            gap:14px;
            justify-content:flex-end;
            align-items:center;
            flex-wrap:wrap;
          }

          .danger-outline {
            background:transparent;
            border:1px solid #ef4444;
            color:#ff6464;
          }

          .danger-outline:hover {
            background:rgba(239,68,68,.12);
          }

          @media(max-width:1100px) {
            .active-delivery-card {
              grid-template-columns:1fr 1fr;
            }

            .delivery-actions {
              justify-content:flex-start;
            }
          }

          @media(max-width:700px) {
            .active-page-head {
              flex-direction:column;
              align-items:flex-start;
            }

            .active-delivery-card {
              grid-template-columns:1fr;
            }
          }
        </style>

        <div class="active-page-head">
          <div class="active-title">
            <h1>Active Deliveries</h1>
            <p>${activeDeliveries.length} deliveries in progress</p>
          </div>

          <label class="active-search">
            <span>⌕</span>
            <input id="activeDeliverySearch" placeholder="Search Delivery ID" />
          </label>
        </div>

        <div class="active-delivery-list" id="activeDeliveryList">
          ${
            activeDeliveries.map(deliveryCard).join('') || `
              <div class="card" style="padding:24px;color:#8f8f8f;text-align:center">
                No active deliveries found.
              </div>
            `
          }
        </div>
      `;

      const searchInput = document.getElementById('activeDeliverySearch');
      const list = document.getElementById('activeDeliveryList');

      function bindCancelButtons() {
        document.querySelectorAll('.bc-cancel-delivery').forEach(function (btn) {
          btn.onclick = async function () {
            const id = btn.dataset.id;

            if (!id) return;
            if (!confirm(`Cancel delivery ${id}?`)) return;

            try {
              if (!D.Deliveries.update || !D.Deliveries.getOne) {
                alert('Cancel/update API is not available.');
                return;
              }

              const existing = await D.Deliveries.getOne(id);

              await D.Deliveries.update(id, {
                ...existing,
                status: 'Cancelled'
              });

              toast('Delivery cancelled');
              await renderActiveDeliveriesPage();
            } catch (error) {
              console.error('Failed to cancel delivery:', error);
              alert('Failed to cancel delivery from backend.');
            }
          };
        });
      }

      if (searchInput && list) {
        searchInput.addEventListener('input', function () {
          const q = searchInput.value.trim().toLowerCase();

          const filtered = activeDeliveries.filter(function (d) {
            return [
              d.id,
              d.deliveryId,
              d.pickup,
              d.destination,
              d.driver,
              d.assignedDriver,
              d.status
            ].join(' ').toLowerCase().includes(q);
          });

          list.innerHTML =
            filtered.map(deliveryCard).join('') || `
              <div class="card" style="padding:24px;color:#8f8f8f;text-align:center">
                No matching active deliveries found.
              </div>
            `;

          bindCancelButtons();
        });
      }

      bindCancelButtons();

    } catch (error) {
      console.error('Failed to load active deliveries:', error);

      root.innerHTML = `
        <div class="card" style="padding:24px;color:#ff8d8d;text-align:center">
          Failed to load active deliveries from backend.
        </div>
      `;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const page = location.pathname.split('/').pop();

    if (page === 'dashboard.html') {
      renderBusinessDashboard();
    }

    if (page === 'create-delivery.html') {
      bindCreateDeliveryPage();
    }

    if (page === 'active-deliveries.html') {
      renderActiveDeliveriesPage();
    }
  });
})();