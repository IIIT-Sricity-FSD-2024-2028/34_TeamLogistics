import { createContext, useContext, useEffect, useState } from 'react';

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [header, setHeaderState] = useState({ title: '', subtitle: '' });
  const setHeader = (title, subtitle = '') => setHeaderState({ title, subtitle });
  return <PageHeaderContext.Provider value={{ header, setHeader }}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeaderContext() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error('usePageHeaderContext must be used within PageHeaderProvider');
  return ctx;
}

export function usePageHeader(title, subtitle = '') {
  const { setHeader } = usePageHeaderContext();
  useEffect(() => {
    setHeader(title, subtitle);
  }, [title, subtitle]);
}
