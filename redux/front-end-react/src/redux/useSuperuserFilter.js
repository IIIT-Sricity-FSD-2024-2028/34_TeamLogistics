import { useCallback } from 'react';
import { useSelector, useStore } from 'react-redux';
import { setFilter } from './superuserSlice';

export function useSuperuserFilter(page, field) {
  const store = useStore();
  const value = useSelector((state) => state.superuser[page][field]);
  const setValue = useCallback((next) => {
    const current = store.getState().superuser[page][field];
    store.dispatch(setFilter({ page, field, value: typeof next === 'function' ? next(current) : next }));
  }, [store, page, field]);
  return [value, setValue];
}
