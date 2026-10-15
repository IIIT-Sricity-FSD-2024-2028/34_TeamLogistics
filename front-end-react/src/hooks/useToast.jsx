import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((msg) => {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2500);
  }, []);

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      {message && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: 10,
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            zIndex: 9999,
            boxShadow: '0 10px 30px rgba(0,0,0,.4)',
          }}
        >
          {message}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
