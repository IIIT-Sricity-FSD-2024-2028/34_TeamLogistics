import { useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { useLiveSync } from '../hooks/useLiveSync';
import { createFleetManagerStore } from './store.js';
import { fleetManagerApi, FLEET_MANAGER_DATA_TAGS } from './fleetManagerApi.js';

function FleetManagerLiveSync() {
  const dispatch = useDispatch();
  useLiveSync(() => dispatch(fleetManagerApi.util.invalidateTags(FLEET_MANAGER_DATA_TAGS)));
  return null;
}

export default function FleetManagerReduxProvider({ children }) {
  const [store] = useState(createFleetManagerStore);
  return <Provider store={store}><FleetManagerLiveSync />{children}</Provider>;
}
