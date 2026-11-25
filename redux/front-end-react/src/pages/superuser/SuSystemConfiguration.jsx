import { useSuperuserDraft } from '../../redux/useSuperuserDraft';
import { useGetSecurityQuery, useGetEconomicsQuery, useGetRateCardQuery, useUpdateSecurityMutation, useUpdateEconomicsMutation, useUpdateRateCardMutation } from '../../redux/superuserApi';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../components/Icon';

export default function SuSystemConfiguration() {
  usePageHeader('System Configuration');
  const { showToast } = useToast();

  const securityQuery = useGetSecurityQuery();
  const economicsQuery = useGetEconomicsQuery();
  const rateCardQuery = useGetRateCardQuery();
  const securityFailed = securityQuery.isError;
  const commissionFailed = economicsQuery.isError;
  const rateCardFailed = rateCardQuery.isError;
  const commissionRate = economicsQuery.data?.commissionRate ?? null;
  const rateCard = rateCardQuery.data;
  const [security, setSecurity] = useSuperuserDraft(securityQuery.data, { passwordLength: 8, failedAttempts: 5, sessionTimeout: 30 });
  const [commissionInput, setCommissionInput, resetCommission] = useSuperuserDraft(economicsQuery.data ? String(economicsQuery.data.commissionRate) : undefined, '');
  const [minimumFleetMarginInput, setMinimumFleetMarginInput, resetMargin] = useSuperuserDraft(economicsQuery.data ? String(economicsQuery.data.minimumFleetMarginPercent) : undefined, '15');
  const [rcBaseFare, setRcBaseFare] = useSuperuserDraft(rateCard ? String(rateCard.baseFare) : undefined, '');
  const [rcPerKm, setRcPerKm] = useSuperuserDraft(rateCard ? String(rateCard.perKm) : undefined, '');
  const [rcPerKg, setRcPerKg] = useSuperuserDraft(rateCard ? String(rateCard.perKg) : undefined, '');
  const [customerBaseFare, setCustomerBaseFare] = useSuperuserDraft(rateCard ? String(rateCard.customerBaseFare) : undefined, '');
  const [customerPerKm, setCustomerPerKm] = useSuperuserDraft(rateCard ? String(rateCard.customerPerKm) : undefined, '');
  const [customerPerKg, setCustomerPerKg] = useSuperuserDraft(rateCard ? String(rateCard.customerPerKg) : undefined, '');
  const [updateSecurity, { isLoading: securitySaving }] = useUpdateSecurityMutation();
  const [updateEconomics, { isLoading: economicsSaving }] = useUpdateEconomicsMutation();
  const [updateRateCard, { isLoading: rateCardSaving }] = useUpdateRateCardMutation();

  async function saveSecurity() {
    try {
      const updated = await updateSecurity({
        passwordLength: security.passwordLength,
        failedAttempts: security.failedAttempts,
        sessionTimeout: security.sessionTimeout,
      }).unwrap();
      setSecurity((prev) => ({ ...prev, ...updated }));
      showToast('Security settings saved');
    } catch (e) {
      alert(e.message || 'Failed to save security settings');
    }
  }

  async function saveCommission() {
    const rate = Number(commissionInput);
    const margin = Number(minimumFleetMarginInput);
    if (Number.isNaN(rate) || Number.isNaN(margin) || rate < 0 || margin < 0 || rate + margin >= 100) {
      alert('Commission and fleet margin must be non-negative and total less than 100%.');
      return;
    }
    try {
      await updateEconomics({ commissionRate: rate, minimumFleetMarginPercent: margin }).unwrap();
      showToast('Revenue economics saved');
      await economicsQuery.refetch();
      resetCommission();
      resetMargin();
    } catch (e) {
      alert(e.message || 'Failed to save commission rate.');
    }
  }

  async function saveRateCard() {
    const baseFare = Number(rcBaseFare);
    const perKm = Number(rcPerKm);
    const perKg = Number(rcPerKg);
    const customerBase = Number(customerBaseFare);
    const customerKm = Number(customerPerKm);
    const customerKg = Number(customerPerKg);
    if (!(baseFare > 0) || !(perKm > 0) || !(perKg > 0) || !(customerBase > 0) || !(customerKm > 0) || !(customerKg > 0)) {
      alert('All rate card values must be positive numbers.');
      return;
    }
    try {
      await updateRateCard({
        baseFare,
        perKm,
        perKg,
        customerBaseFare: customerBase,
        customerPerKm: customerKm,
        customerPerKg: customerKg,
      }).unwrap();
      showToast('Platform rate card saved');
      await rateCardQuery.refetch();
    } catch (e) {
      alert(e.message || 'Failed to save rate card.');
    }
  }

  return (
    <>
      <div className="content-card settings-section">
        <div className="settings-head">
          <div className="settings-icon">{Icon.shield}</div>
          <div>
            <strong>Security Settings</strong>
            <span>Manage system security and authentication</span>
          </div>
        </div>
        <div className="settings-body">
          <div className="field">
            <label>Password Minimum Length</label>
            <input type="number" value={security.passwordLength} onChange={(e) => setSecurity((s) => ({ ...s, passwordLength: +e.target.value || 8 }))} />
            <div className="form-note">Minimum characters required for passwords</div>
          </div>
          <div className="field">
            <label>Failed Login Attempts</label>
            <input type="number" value={security.failedAttempts} onChange={(e) => setSecurity((s) => ({ ...s, failedAttempts: +e.target.value || 5 }))} />
            <div className="form-note">Maximum failed attempts before a 15-minute account lock</div>
          </div>
          <div className="field">
            <label>Session Timeout (minutes)</label>
            <input type="number" value={security.sessionTimeout} onChange={(e) => setSecurity((s) => ({ ...s, sessionTimeout: +e.target.value || 30 }))} />
            <div className="form-note">JWT session lifetime issued at sign-in</div>
          </div>
          <div style={{ marginTop: 22 }}>
            <button className="btn-yellow" disabled={securitySaving || !securityQuery.data || securityFailed} onClick={saveSecurity}>Save Security Settings</button>
          </div>
        </div>
      </div>

      <div className="content-card settings-section">
        <div className="settings-head">
          <div className="settings-icon">{Icon.gear}</div>
          <div>
            <strong>Revenue Economics</strong>
            <span>Protect platform commission and a minimum fleet margin on every pricing component</span>
          </div>
        </div>
        <div className="settings-body">
          {commissionFailed && <div style={{ color: '#ff6b6b', padding: '8px 0' }}>Failed to load commission rate.</div>}
          {!commissionFailed && commissionRate === null && <div style={{ color: '#b9b9b9', padding: '8px 0' }}>Loading commission rate...</div>}
          {!commissionFailed && commissionRate !== null && (
            <>
              <div className="field">
                <label>Platform Commission (%)</label>
                <input type="number" min={0} max={80} step={0.1} value={commissionInput} onChange={(e) => setCommissionInput(e.target.value)} />
              </div>
              <div className="field">
                <label>Minimum Fleet Margin (%)</label>
                <input type="number" min={0} max={80} step={0.1} value={minimumFleetMarginInput} onChange={(e) => setMinimumFleetMarginInput(e.target.value)} />
              </div>
              <div className="form-note">Customer prices must cover driver payout plus both percentages. Historical transactions keep their original commission snapshot.</div>
              <button className="btn-yellow" style={{ marginTop: 12 }} disabled={economicsSaving} onClick={saveCommission}>Save Economics</button>
            </>
          )}
        </div>
      </div>

      <div className="content-card settings-section">
        <div className="settings-head">
          <div className="settings-icon">{Icon.gear}</div>
          <div>
            <strong>Platform Pricing & Driver Payout Floors</strong>
            <span>Customer selling prices and the minimum amounts used to calculate driver earnings</span>
          </div>
        </div>
        <div className="settings-body">
          {rateCardFailed && <div style={{ color: '#ff6b6b', padding: '8px 0' }}>Failed to load rate card.</div>}
          {!rateCardFailed && !rateCard && <div style={{ color: '#b9b9b9', padding: '8px 0' }}>Loading rate card...</div>}
          {!rateCardFailed && rateCard && (
            <>
              <div className="field">
                <label>Minimum Driver Base Payout (₹ per trip)</label>
                <input type="number" min={0} step={0.01} value={rcBaseFare} onChange={(e) => setRcBaseFare(e.target.value)} />
              </div>
              <div className="field">
                <label>Minimum Driver Rate per Km (₹)</label>
                <input type="number" min={0} step={0.01} value={rcPerKm} onChange={(e) => setRcPerKm(e.target.value)} />
              </div>
              <div className="field">
                <label>Minimum Driver Rate per Kg (₹)</label>
                <input type="number" min={0} step={0.01} value={rcPerKg} onChange={(e) => setRcPerKg(e.target.value)} />
              </div>
              <div className="field">
                <label>Default Customer Base Price (₹ per trip)</label>
                <input type="number" min={0} step={0.01} value={customerBaseFare} onChange={(e) => setCustomerBaseFare(e.target.value)} />
              </div>
              <div className="field">
                <label>Default Customer Price per Km (₹)</label>
                <input type="number" min={0} step={0.01} value={customerPerKm} onChange={(e) => setCustomerPerKm(e.target.value)} />
              </div>
              <div className="field">
                <label>Default Customer Price per Kg (₹)</label>
                <input type="number" min={0} step={0.01} value={customerPerKg} onChange={(e) => setCustomerPerKg(e.target.value)} />
              </div>
              <div className="form-note">The backend rejects customer rates that cannot fund driver payout, commission, and the configured fleet margin.</div>
              <button className="btn-yellow" style={{ marginTop: 12 }} disabled={rateCardSaving} onClick={saveRateCard}>Save Rate Card</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
