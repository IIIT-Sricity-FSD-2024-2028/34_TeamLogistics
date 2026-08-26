(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function money(v) {
    return `₹${Number(v || 0).toLocaleString('en-IN')}`;
  }

  function formatDate(v) {
    if (!v) return '--';
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function statusColor(status) {
    if (status === 'active') return '#69e38f';
    if (status === 'expired') return '#ffad59';
    return '#ff8d8d';
  }

  function renderCurrentSubscription(subscription) {
    const box = document.getElementById('fmCurrentSubscription');
    if (!box) return;

    if (!subscription) {
      box.innerHTML = `
        <div class="muted" style="margin-bottom:6px">You don't have an active subscription.</div>
        <div>Choose a plan below to start using fleet management.</div>
      `;
      return;
    }

    box.innerHTML = `
      <div class="form-grid" style="grid-template-columns:repeat(4,1fr);gap:14px">
        <div><div class="muted">Current Plan</div><div style="font-weight:800;font-size:18px">${subscription.plan}</div></div>
        <div><div class="muted">Price</div><div style="font-weight:800;font-size:18px">${money(subscription.amount)} / month</div></div>
        <div><div class="muted">Billing Cycle</div><div style="font-weight:700;text-transform:capitalize">${subscription.billingCycle}</div></div>
        <div><div class="muted">Status</div><span class="pill ${subscription.status === 'active' ? 'pill-green' : subscription.status === 'expired' ? 'pill-orange' : 'pill-red'}">${subscription.status}</span></div>
        <div><div class="muted">Start Date</div><div style="font-weight:700">${formatDate(subscription.startDate)}</div></div>
        <div><div class="muted">Renewal / Expiry Date</div><div style="font-weight:700">${formatDate(subscription.endDate)}</div></div>
        <div><div class="muted">Payment Status</div><div style="font-weight:700;text-transform:capitalize">${subscription.paymentStatus}</div></div>
        <div><div class="muted">Vehicle Limit</div><div style="font-weight:700">${subscription.vehicleLimit} vehicles</div></div>
      </div>
      ${subscription.status !== 'active'
        ? `<div style="color:#ff8d8d;margin-top:16px">Your subscription is ${subscription.status}. Choose a plan below to renew.</div>`
        : ''}
    `;
  }

  function planCard(planName, plan, subscription) {
    const isCurrentActive = subscription && subscription.plan === planName && subscription.status === 'active';

    let label = 'Choose Plan';
    if (isCurrentActive) label = 'Current Plan';
    else if (subscription && subscription.status === 'active') label = 'Change Plan';
    else if (subscription) label = 'Renew Plan';

    return `
      <div class="info-card" style="${isCurrentActive ? 'border:1px solid #ffd400' : ''}">
        <h3 style="margin:0 0 6px">${planName}</h3>
        <div style="font-size:22px;font-weight:800;margin-bottom:6px">
          ${money(plan.amount)} <span style="font-size:12px;font-weight:500;color:#9ca3af">/ month</span>
        </div>
        <div class="muted" style="text-transform:capitalize">Billing: ${plan.billingCycle}</div>
        <div class="muted" style="margin-bottom:16px">Up to ${plan.vehicleLimit} vehicles</div>
        <button class="btn btn-yellow" data-plan="${planName}" data-amount="${plan.amount}" ${isCurrentActive ? 'disabled' : ''} style="width:100%">
          ${label}
        </button>
      </div>
    `;
  }

  async function loadAndRender() {
    const D = window.DeliverySyncAPI;
    const currentBox = document.getElementById('fmCurrentSubscription');
    const plansBox = document.getElementById('fmSubscriptionPlans');
    if (!D || !D.Subscriptions || !currentBox || !plansBox) return;

    if (D.getCurrentRole() !== 'fleet-manager') {
      currentBox.innerHTML = `<div style="color:#ff8d8d">Subscription management is only available to Fleet Manager accounts.</div>`;
      plansBox.innerHTML = '';
      return;
    }

    currentBox.innerHTML = 'Loading subscription...';
    plansBox.innerHTML = '<div class="info-card">Loading plans...</div>';

    try {
      const [plans, { subscription }] = await Promise.all([
        D.Subscriptions.getPlans(),
        D.Subscriptions.getCurrent(),
      ]);

      renderCurrentSubscription(subscription);

      plansBox.innerHTML = Object.entries(plans)
        .map(([name, plan]) => planCard(name, plan, subscription))
        .join('');

      plansBox.querySelectorAll('button[data-plan]').forEach((btn) => {
        btn.onclick = async () => {
          const plan = btn.dataset.plan;
          const amount = btn.dataset.amount;

          if (!confirm(`Pay ${money(amount)} for the ${plan} plan?`)) return;

          btn.disabled = true;
          btn.textContent = 'Processing payment...';

          try {
            await D.Subscriptions.pay(plan, 'Demo Payment');
            alert('Payment Successful. Subscription activated.');
            await loadAndRender();
          } catch (error) {
            console.error('Subscription payment failed:', error);
            alert(`Payment failed: ${error.message}`);
            await loadAndRender();
          }
        };
      });
    } catch (error) {
      console.error('Failed to load subscription from backend:', error);
      currentBox.innerHTML = '<div style="color:#ff8d8d">Failed to load subscription from backend.</div>';
      plansBox.innerHTML = '';
    }
  }

  ready(loadAndRender);
})();
