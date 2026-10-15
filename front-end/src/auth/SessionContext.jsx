import { createContext, useContext, useEffect, useState } from 'react';
import { getSession, setSession, clearSession, SESSION_CHANGED_EVENT } from '../api/client';
import { connectLiveUpdates } from '../api/liveUpdates';

const SessionCtx = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSessionState] = useState(() => getSession());

  useEffect(() => {
    const syncSession = () => setSessionState(getSession());
    window.addEventListener(SESSION_CHANGED_EVENT, syncSession);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, syncSession);
    };
  }, []);

  useEffect(() => {
    if (!session?.token) return undefined;
    return connectLiveUpdates(session.token);
  }, [session?.token]);

  function login(newSession) {
    setSession(newSession);
    setSessionState(newSession);
  }

  function logout() {
    clearSession();
    setSessionState(null);
  }

  function updateSession(updates) {
    const currentSession = getSession() || session;
    if (!currentSession) return;
    const nextSession = { ...currentSession, ...updates };
    setSession(nextSession);
    setSessionState(nextSession);
  }

  return <SessionCtx.Provider value={{ session, login, logout, updateSession }}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
