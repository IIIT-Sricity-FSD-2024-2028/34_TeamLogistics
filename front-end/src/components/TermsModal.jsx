import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TERMS_EFFECTIVE_DATE } from '../constants/legal';

export default function TermsModal({ open, onClose, onAccept }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    modalRef.current?.focus();

    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="terms-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={modalRef} className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-modal-title" tabIndex="-1">
        <header className="terms-modal-header">
          <div>
            <span className="terms-modal-eyebrow">DeliverSync legal</span>
            <h2 id="terms-modal-title">Terms &amp; Conditions</h2>
            <p>Effective {TERMS_EFFECTIVE_DATE}</p>
          </div>
          <button className="terms-modal-close" type="button" onClick={onClose} aria-label="Close terms and conditions">
            ×
          </button>
        </header>

        <div className="terms-modal-body" tabIndex="0">
          <div className="terms-modal-summary">
            <span aria-hidden="true">i</span>
            <p>Please read these terms before creating your DeliverSync account.</p>
          </div>

          <section>
            <h3>1. Agreement</h3>
            <p>
              By creating an account or using DeliverSync, you agree to these Terms &amp; Conditions. If you register for a business, you confirm that you are authorised to accept these terms on its behalf.
            </p>
          </section>

          <section>
            <h3>2. Accounts and approval</h3>
            <p>
              You must provide complete and accurate registration information and keep your login details secure. Business client and driver accounts may be reviewed before access is approved. We may request information needed to verify identity, eligibility, banking details, licences, or business details.
            </p>
          </section>

          <section>
            <h3>3. Responsible use</h3>
            <ul>
              <li>Business clients must provide accurate pickup, delivery, shipment, and contact details.</li>
              <li>Drivers must hold a valid licence, submit authentic documents, and follow applicable road and safety laws.</li>
              <li>All users must keep delivery statuses, proof of delivery, vehicle records, and payment information accurate.</li>
              <li>DeliverSync must not be used for unlawful, fraudulent, abusive, or unsafe activity.</li>
            </ul>
          </section>

          <section>
            <h3>4. Charges and payouts</h3>
            <p>
              Prices, fees, post-paid invoices, payments, and driver payouts are subject to the relevant delivery or commercial arrangement. Users are responsible for reviewing transaction information and reporting errors promptly.
            </p>
          </section>

          <section>
            <h3>5. Service availability</h3>
            <p>
              We work to keep DeliverSync reliable, but uninterrupted access is not guaranteed. Features may be maintained, updated, suspended, or changed to improve safety, performance, or compliance.
            </p>
          </section>

          <section>
            <h3>6. Suspension or termination</h3>
            <p>
              We may restrict or close an account that violates these terms, creates a safety or security risk, provides false information, or misuses the service. You may stop using DeliverSync at any time.
            </p>
          </section>

          <section>
            <h3>7. Responsibility</h3>
            <p>
              Each user remains responsible for their conduct, legal obligations, shipments, vehicles, and decisions. To the extent permitted by law, DeliverSync is not responsible for indirect losses caused by incorrect user information or circumstances outside our reasonable control.
            </p>
          </section>

          <section>
            <h3>8. Contact and updates</h3>
            <p>
              We may update these terms as DeliverSync evolves. For questions, contact <a href="mailto:support@deliverysync.com">support@deliverysync.com</a>.
            </p>
          </section>
        </div>

        <footer className="terms-modal-footer">
          <p>By selecting “Accept terms”, you confirm that you have read and accepted this agreement.</p>
          <div>
            <button className="terms-modal-cancel" type="button" onClick={onClose}>Cancel</button>
            <button className="terms-modal-accept" type="button" onClick={onAccept}>Accept terms</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
