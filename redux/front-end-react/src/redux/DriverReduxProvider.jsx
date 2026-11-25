import { useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { useLiveSync } from '../hooks/useLiveSync';
import { driverApi, DRIVER_DATA_TAGS } from './driverApi.js';
import { createDriverStore } from './store.js';

function DriverLiveSync() {
  const dispatch = useDispatch();
  // One listener/timer for the portal. Only subscribed queries are refetched.
  useLiveSync(() => dispatch(driverApi.util.invalidateTags(DRIVER_DATA_TAGS)));
  return null;
}

export default function DriverReduxProvider({ children }) {
  const [store] = useState(createDriverStore);
  return (
    <Provider store={store}>
      <DriverLiveSync />
      {children}
    </Provider>
  );
}
