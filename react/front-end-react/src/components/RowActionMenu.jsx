import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './RowActionMenu.css';

export default function RowActionMenu({ children, label = 'Open actions' }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth || 190;
    const menuHeight = menuRef.current?.offsetHeight || 220;
    const left = Math.max(12, Math.min(trigger.right - menuWidth, window.innerWidth - menuWidth - 12));
    const spaceBelow = window.innerHeight - trigger.bottom;
    const top = spaceBelow >= menuHeight + 12
      ? trigger.bottom + 6
      : Math.max(12, trigger.top - menuHeight - 6);

    setPosition({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function closeFromOutside(event) {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function closeFromKeyboard(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function closeFromViewportChange() {
      setOpen(false);
    }

    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    window.addEventListener('resize', closeFromViewportChange);
    window.addEventListener('scroll', closeFromViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
      window.removeEventListener('resize', closeFromViewportChange);
      window.removeEventListener('scroll', closeFromViewportChange, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="row-action-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="row-action-popover"
          role="menu"
          style={position}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
