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
      s.includes('pending') ||
      s.includes('queued') ||
      s.includes('approved') ||
      s.includes('accepted') ||
      s.includes('issue') ||
      s.includes('blocked')
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

  async function getCurrentClientNames() {
    try {
      const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
      if (!session || !session.userId || !D || !D.Users) return [];
      const getById = D.Users.getById || D.Users.getOne;
      const user = await getById(session.userId);
      if (!user) return [];
      return [user.name, user.username, user.companyName, user.company, user.profileDetails?.companyName]
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase());
    } catch (e) {
      console.error('Failed to resolve current business client identity:', e);
      return [];
    }
  }

  function belongsToCurrentClient(delivery, clientNames) {
    if (!clientNames.length) return false;
    const c = String(delivery.customer || delivery.client || '').trim().toLowerCase();
    if (!c) return false;
    return clientNames.some((name) => c === name || c.includes(name) || name.includes(c));
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
      const [deliveries, invoices, clientNames] = await Promise.all([
        D.Deliveries.getAll(),
        D.Transactions && D.Transactions.getInvoices
          ? D.Transactions.getInvoices()
          : Promise.resolve([]),
        getCurrentClientNames()
      ]);

      const allDeliveries = (deliveries || []).filter(function (d) {
        return belongsToCurrentClient(d, clientNames);
      });
      const myInvoices = (invoices || []).filter(function (inv) {
        return belongsToCurrentClient({ customer: inv.client }, clientNames);
      });

      const activeDeliveries = allDeliveries.filter(function (d) {
        return isActiveStatus(d.status);
      });

      const completedDeliveries = allDeliveries.filter(function (d) {
        return isCompletedStatus(d.status);
      });

      const unpaidInvoices = myInvoices.filter(function (inv) {
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

    const packageTypeSelect = document.getElementById('packageType');
    const pkgLengthInput = document.getElementById('pkgLength');
    const pkgWidthInput = document.getElementById('pkgWidth');
    const pkgHeightInput = document.getElementById('pkgHeight');
    const pkgWeightInput = document.getElementById('pkgWeight');

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

      const packageType = packageTypeSelect ? packageTypeSelect.value : '';
      const pkgLength = pkgLengthInput ? parseFloat(pkgLengthInput.value) : NaN;
      const pkgWidth = pkgWidthInput ? parseFloat(pkgWidthInput.value) : NaN;
      const pkgHeight = pkgHeightInput ? parseFloat(pkgHeightInput.value) : NaN;
      const pkgWeight = pkgWeightInput ? parseFloat(pkgWeightInput.value) : NaN;

      const deliveryType = typeInput ? typeInput.value : 'standard';

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

      if (!packageType) {
        setError(packageTypeSelect, 'Package type is required');
        valid = false;
      }

      if (isNaN(pkgLength) || pkgLength <= 0 || pkgLength > 1000) {
        setError(pkgLengthInput, 'Length must be between 1 and 1000 cm');
        valid = false;
      }

      if (isNaN(pkgWidth) || pkgWidth <= 0 || pkgWidth > 1000) {
        setError(pkgWidthInput, 'Width must be between 1 and 1000 cm');
        valid = false;
      }

      if (isNaN(pkgHeight) || pkgHeight <= 0 || pkgHeight > 1000) {
        setError(pkgHeightInput, 'Height must be between 1 and 1000 cm');
        valid = false;
      }

      if (isNaN(pkgWeight) || pkgWeight <= 0 || pkgWeight > 1000) {
        setError(pkgWeightInput, 'Weight must be between 0.1 and 1000 kg');
        valid = false;
      }

      if (file) {
        var ext = file.name.split('.').pop().toLowerCase();

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

      let customerName = 'Business Client';
      try {
        const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
        const getById = D.Users && (D.Users.getById || D.Users.getOne);
        if (session && session.userId && getById) {
          const user = await getById(session.userId);
          customerName =
            (user && (user.companyName || user.company || (user.profileDetails && user.profileDetails.companyName) || user.name)) ||
            customerName;
        }
      } catch (err) {
        console.error('Failed to resolve current business client for delivery creation:', err);
      }

      var payload = {
        customer: customerName,
        pickup: pickup,
        dropoff: destination,
        packageType: packageType,
        packageDimensions: {
          length: pkgLength,
          width: pkgWidth,
          height: pkgHeight,
          unit: 'cm'
        },
        weight: pkgWeight,
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
        toast('Failed to create delivery');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const page = location.pathname.split('/').pop();

    if (page === 'dashboard.html') {
      renderBusinessDashboard();
    }

    if (page === 'create-delivery.html') {
      bindCreateDeliveryPage();
    }
  });
})();