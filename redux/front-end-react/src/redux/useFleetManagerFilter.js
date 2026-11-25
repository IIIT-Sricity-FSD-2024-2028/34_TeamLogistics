import { useCallback } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { setFilter } from './fleetManagerSlice.js';

export function useFleetManagerFilter(page, field) {
  const value = useSelector((state) => state.fleetManager[page][field]);
  const dispatch = useDispatch();
  const store = useStore();
  const update = useCallback((next) => {
    const current = store.getState().fleetManager[page][field];
    dispatch(setFilter({ page, field, value: typeof next === 'function' ? next(current) : next }));
  }, [dispatch, field, page, store]);
  return [value, update];
}
