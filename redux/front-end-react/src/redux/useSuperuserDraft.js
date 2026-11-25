import { useState } from 'react';

// Use the saved value until editing starts; background refreshes then leave
// the user's draft alone. Call reset after saving to show the refreshed value.
export function useSuperuserDraft(savedValue, fallback) {
  const [draft, setDraft] = useState(undefined);
  const value = draft === undefined ? savedValue ?? fallback : draft;
  const setValue = (next) => setDraft((previous) => {
    const current = previous === undefined ? savedValue ?? fallback : previous;
    return typeof next === 'function' ? next(current) : next;
  });
  return [value, setValue, () => setDraft(undefined)];
}
