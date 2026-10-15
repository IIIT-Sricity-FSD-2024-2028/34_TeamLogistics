import { createPortal } from 'react-dom';

export default function Modal({ onClose, children }) {
  return createPortal(
    <div
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ maxHeight: '90vh', overflow: 'auto', width: '100%' }}>{children}</div>
    </div>,
    document.body
  );
}
