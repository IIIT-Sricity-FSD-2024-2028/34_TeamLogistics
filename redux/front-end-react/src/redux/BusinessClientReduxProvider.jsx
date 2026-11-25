import { useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { useLiveSync } from '../hooks/useLiveSync';
import { businessClientApi, BUSINESS_CLIENT_DATA_TAGS } from './businessClientApi.js';
import { createBusinessClientStore } from './store.js';

function BusinessClientLiveSync() {
  const dispatch = useDispatch();
  useLiveSync(() => dispatch(businessClientApi.util.invalidateTags(BUSINESS_CLIENT_DATA_TAGS)));
  return null;
}

export default function BusinessClientReduxProvider({ children }) {
  const [store] = useState(createBusinessClientStore);
  return <Provider store={store}><BusinessClientLiveSync />{children}</Provider>;
}
