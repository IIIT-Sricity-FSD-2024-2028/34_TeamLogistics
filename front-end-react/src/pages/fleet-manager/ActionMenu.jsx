import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 190;

export default function ActionMenu({ children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, visibility: 'hidden' });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;

    const trigger = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - trigger.bottom;
    const openAbove = spaceBelow < menuHeight + 16 && trigger.top > spaceBelow;
    const top = openAbove
      ? Math.max(8, trigger.top - menuHeight - 8)
      : Math.min(trigger.bottom + 8, window.innerHeight - menuHeight - 8);
    const left = Math.min(
      Math.max(8, trigger.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );

    setPosition({ top, left, visibility: 'visible' });
  }, [open, children]);

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutsidePress(event) {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function closeOnViewportChange() {
      setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [open]);

  return (
    <div className="actions">
      <button
        ref={buttonRef}
        className="dots"
        type="button"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setPosition({ top: 0, left: 0, visibility: 'hidden' });
          setOpen((current) => !current);
        }}
      >
        ⋯
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="fm-floating-menu"
          role="menu"
          style={position}
          onClick={(event) => {
            if (event.target.closest?.('a,button')) setOpen(false);
          }}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
