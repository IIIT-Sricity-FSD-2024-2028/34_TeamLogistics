import { useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { useLiveSync } from '../hooks/useLiveSync';
import { superuserApi, SUPERUSER_DATA_TAGS } from './superuserApi.js';
import { createSuperuserStore } from './store.js';

function SuperuserLiveSync() {
  const dispatch = useDispatch();
  useLiveSync(() => dispatch(superuserApi.util.invalidateTags(SUPERUSER_DATA_TAGS)));
  return null;
}

export default function SuperuserReduxProvider({ children }) {
  const [store] = useState(createSuperuserStore);
  return <Provider store={store}><SuperuserLiveSync />{children}</Provider>;
}
