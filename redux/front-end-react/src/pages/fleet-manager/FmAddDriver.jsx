import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateDriverMutation } from '../../redux/fleetManagerApi';
import TermsModal from '../../components/TermsModal';
import { TERMS_VERSION } from '../../constants/legal';
import { usePageHeader } from '../../hooks/usePageHeader';
import { usePortalStyles } from '../../hooks/usePortalStyles';
import { useToast } from '../../hooks/useToast';
import { validateDriverRegistration } from '../../utils/driverRegistration';
import { minimumFutureDate } from '../../utils/dateConstraints';

const statuses = ['Available', 'Unavailable', 'Suspended', 'Rejected'];

export default function FmAddDriver() {
  usePageStyleScope('fm-add-driver');
  usePortalStyles(['terms-modal.css']);
  usePageHeader('Add Driver', 'Create a driver account and fleet profile');
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [license, setLicense] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [licenseDoc, setLicenseDoc] = useState(null);
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBook, setBankBook] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(statuses[0]);
  const [terms, setTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [createDriver] = useCreateDriverMutation();

  async function save(event) {
    event.preventDefault();
    const validationErrors = validateDriverRegistration({
      name,
      phone,
      license,
      licenseExpiry,
      licenseDoc,
      accountHolder,
      accountNumber,
      ifsc,
      bankName,
      bankBook,
      email,
      password,
      confirmPassword,
      terms,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      password,
      licenseNumber: license.trim().toUpperCase(),
      licenseExpiry,
      status,
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      profileDetails: {
        licenseNumber: license.trim().toUpperCase(),
        licenseExpiry,
        licenseDocument: licenseDoc.name,
        accountHolderName: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifsc.trim().toUpperCase(),
        bankName: bankName.trim(),
        bankBook: bankBook.name,
      },
    };

    setSubmitting(true);
    try {
      await createDriver(payload).unwrap();
      showToast('Driver account created');
      navigate('/fleet-manager/drivers');
    } catch (error) {
      console.error(error);
      setErrors((current) => ({ ...current, submit: error.message || 'Failed to create driver' }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="panel panel-form fm-driver-form" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <span className="panel-icon" aria-hidden="true">👤</span>
          <div className="panel-title">Add New Driver</div>
        </div>
        <form className="panel-body" onSubmit={save} noValidate>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="fm-driver-name">Full Name</label>
              <input id="fm-driver-name" type="text" placeholder="Enter full name" value={name} onChange={(event) => setName(event.target.value)} />
              <div className="field-error">{errors.name}</div>
            </div>
            <div className="field">
              <label htmlFor="fm-driver-phone">Phone Number</label>
              <input id="fm-driver-phone" type="text" inputMode="numeric" placeholder="Enter phone" maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value)} />
              <div className="field-error">{errors.phone}</div>
            </div>
            <div className="field">
              <label htmlFor="fm-driver-license">Driver License Number</label>
              <input id="fm-driver-license" type="text" placeholder="AA-12-1234-1234567" value={license} onChange={(event) => setLicense(event.target.value)} />
              <div className="field-error">{errors.license}</div>
            </div>
            <div className="field">
              <label htmlFor="fm-driver-license-expiry">License Expiry Date</label>
              <input id="fm-driver-license-expiry" type="date" min={minimumFutureDate()} value={licenseExpiry} onChange={(event) => setLicenseExpiry(event.target.value)} />
              <div className="field-error">{errors.licenseExpiry}</div>
            </div>
            <div className="field">
              <label htmlFor="fm-driver-license-file">Upload License</label>
              <div className="fm-file-upload">
                <label className="btn btn-ghost" htmlFor="fm-driver-license-file">Choose PNG</label>
                <input id="fm-driver-license-file" type="file" accept=".png,image/png" onChange={(event) => setLicenseDoc(event.target.files?.[0] || null)} />
                <span>{licenseDoc ? licenseDoc.name : 'No file chosen'}</span>
              </div>
              <div className="field-error">{errors.licenseDoc}</div>
            </div>

            <section className="fm-bank-details">
              <h3>Bank Details</h3>
              <div className="form-grid">
                <div className="field fm-full-width">
                  <label htmlFor="fm-driver-account-holder">Account Holder Name</label>
                  <input id="fm-driver-account-holder" type="text" placeholder="Enter account holder name" value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} />
                  <div className="field-error">{errors.accountHolder}</div>
                </div>
                <div className="field">
                  <label htmlFor="fm-driver-account-number">Account Number</label>
                  <input id="fm-driver-account-number" type="text" inputMode="numeric" maxLength={12} placeholder="Enter 12-digit account number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
                  <div className="field-error">{errors.accountNumber}</div>
                </div>
                <div className="field">
                  <label htmlFor="fm-driver-ifsc">IFSC Code</label>
                  <input id="fm-driver-ifsc" type="text" maxLength={11} placeholder="Enter IFSC" value={ifsc} onChange={(event) => setIfsc(event.target.value)} />
                  <div className="field-error">{errors.ifsc}</div>
                </div>
                <div className="field fm-full-width">
                  <label htmlFor="fm-driver-bank-name">Bank Name</label>
                  <input id="fm-driver-bank-name" type="text" placeholder="Enter bank name" value={bankName} onChange={(event) => setBankName(event.target.value)} />
                  <div className="field-error">{errors.bankName}</div>
                </div>
                <div className="field fm-full-width">
                  <label htmlFor="fm-driver-bank-book">Upload Bank Book</label>
                  <div className="fm-file-upload">
                    <label className="btn btn-ghost" htmlFor="fm-driver-bank-book">Choose PNG</label>
                    <input id="fm-driver-bank-book" type="file" accept=".png,image/png" onChange={(event) => setBankBook(event.target.files?.[0] || null)} />
                    <span>{bankBook ? bankBook.name : 'No file chosen'}</span>
                  </div>
                  <div className="field-error">{errors.bankBook}</div>
                </div>
              </div>
            </section>

            <div className="field">
              <label htmlFor="fm-driver-email">Email</label>
              <input id="fm-driver-email" type="email" placeholder="Enter email address" value={email} onChange={(event) => setEmail(event.target.value)} />
              <div className="field-error">{errors.email}</div>
            </div>
            <div className="field">
              <label htmlFor="fm-driver-status">Status</label>
              <select id="fm-driver-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                {statuses.map((item) => <option key={item}>{item}</option>)}
              </select>
              <div className="field-error" />
            </div>
            <div className="field">
              <label htmlFor="fm-driver-password">Password</label>
              <div className="fm-password-wrap">
                <input id="fm-driver-password" type={showPassword ? 'text' : 'password'} placeholder="Enter password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
              <div className="field-error">{errors.password}</div>
            </div>
            <div className="field">
              <label htmlFor="fm-driver-confirm-password">Confirm Password</label>
              <div className="fm-password-wrap">
                <input id="fm-driver-confirm-password" type={showConfirm ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                <button type="button" onClick={() => setShowConfirm((current) => !current)}>{showConfirm ? 'Hide' : 'Show'}</button>
              </div>
              <div className="field-error">{errors.confirmPassword}</div>
            </div>
            <div className="field fm-full-width">
              <label className="fm-legal-consent">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(event) => event.target.checked ? setShowTerms(true) : setTerms(false)}
                  aria-describedby="fm-driver-terms-error"
                />
                <span>
                  I have read and agree to the{' '}
                  <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setShowTerms(true); }}>
                    Terms &amp; Conditions
                  </button>.
                </span>
              </label>
              <div className="field-error" id="fm-driver-terms-error">{errors.terms}</div>
            </div>
          </div>

          {errors.submit && <div className="fm-submit-error" role="alert">{errors.submit}</div>}
          <div className="footer-actions">
            <Link className="btn btn-ghost" to="/fleet-manager/drivers">Cancel</Link>
            <button className="btn btn-yellow" type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Driver'}
            </button>
          </div>
        </form>
      </section>

      <TermsModal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={() => {
          setTerms(true);
          setErrors((current) => ({ ...current, terms: '' }));
          setShowTerms(false);
        }}
      />

    </>
  );
}
