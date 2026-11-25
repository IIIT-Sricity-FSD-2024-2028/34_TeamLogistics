import { configureStore } from '@reduxjs/toolkit';
import driverReducer from './driverSlice.js';
import { driverApi } from './driverApi.js';
import businessClientReducer from './businessClientSlice.js';
import { businessClientApi } from './businessClientApi.js';
import superuserReducer from './superuserSlice.js';
import { superuserApi } from './superuserApi.js';
import fleetManagerReducer from './fleetManagerSlice.js';
import { fleetManagerApi } from './fleetManagerApi.js';

// A new store per driver session prevents cached data crossing account boundaries.
export function createDriverStore({ driverRequest } = {}) {
  return configureStore({
    reducer: { driver: driverReducer, [driverApi.reducerPath]: driverApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      thunk: { extraArgument: { driverRequest } },
    }).concat(driverApi.middleware),
  });
}

export function createBusinessClientStore({ businessClientRequest } = {}) {
  return configureStore({
    reducer: { businessClient: businessClientReducer, [businessClientApi.reducerPath]: businessClientApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      thunk: { extraArgument: { businessClientRequest } },
    }).concat(businessClientApi.middleware),
  });
}

export function createSuperuserStore({ superuserRequest } = {}) {
  return configureStore({
    reducer: { superuser: superuserReducer, [superuserApi.reducerPath]: superuserApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      thunk: { extraArgument: { superuserRequest } },
    }).concat(superuserApi.middleware),
  });
}

export function createFleetManagerStore({ fleetManagerRequest } = {}) {
  return configureStore({
    reducer: { fleetManager: fleetManagerReducer, [fleetManagerApi.reducerPath]: fleetManagerApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      thunk: { extraArgument: { fleetManagerRequest } },
    }).concat(fleetManagerApi.middleware),
  });
}
