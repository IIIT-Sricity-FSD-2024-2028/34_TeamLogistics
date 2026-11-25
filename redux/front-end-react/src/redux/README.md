# Portal Redux stores

`DriverLayout` mounts `DriverReduxProvider` for the signed-in driver. A new store
is created when the account or token changes, so cached data and filters cannot
carry over to another account.

- `store.js` configures Redux Toolkit, the UI slice, and RTK Query middleware.
- `driverSlice.js` stores dashboard filters and history search/pagination.
- `driverApi.js` is the API slice for trips, deliveries, payouts, profiles,
  notifications, document uploads, and driver mutations. It reuses the existing
  authenticated API transport.
- `useDriverTrip.js` reads a trip and its delivery without showing the previous
  trip while a new URL is loading.
- `DriverReduxProvider.jsx` has one live-sync listener for the portal. Successful
  mutations and live events invalidate cached data and refresh active queries.

`BusinessClientLayout` mounts `BusinessClientReduxProvider` with a separate
store for each business client session. Its cache is independent of the driver
portal and is replaced when the account or token changes.

- `store.js` exports `createDriverStore` and `createBusinessClientStore`.
- `businessClientSlice.js` stores active-delivery filters, completed-delivery
  search/pagination, and transaction tabs/filters.
- `businessClientApi.js` manages deliveries, quotes, trips, drivers, vehicles,
  invoices, payments, profile data, notifications, and document uploads.
- `BusinessClientReduxProvider.jsx` keeps subscribed data current through one
  live-sync listener. Mutations refresh affected queries automatically.
- `useBcCurrentUser.js` shares the profile query across the header and pages.
  Profile refreshes do not overwrite an open editing form.

`SuperuserLayout` mounts `SuperuserReduxProvider` using `createSuperuserStore`.
Its cache and filters are isolated from other portals and reset when the
account or token changes.

- `superuserSlice.js` stores list searches, filters, tabs, and pagination.
- `superuserApi.js` manages dashboard data, users, approvals, deliveries, trips,
  vehicles, maintenance, documents, transactions, payouts, settlements,
  settings, permissions, profiles, and notifications.
- `SuperuserReduxProvider.jsx` owns one live-sync listener. Successful mutations
  refresh related queries; permission updates refresh the affected role.
- `useSuperuserFilter.js` reads and updates UI filters. `useSuperuserDraft.js`
  keeps unsaved form edits intact during background query refreshes.
- `SuperuserDocumentDetails.jsx` shares cached related records with other pages.
  Document file downloads use the authenticated transport directly so binary
  blobs stay outside the Redux store.

`FleetManagerLayout` mounts `FleetManagerReduxProvider` using a new store for
each signed-in fleet manager session.

- `fleetManagerSlice.js` stores vehicle, driver, compliance, trip, maintenance,
  document, and finance filters.
- `fleetManagerApi.js` shares dashboard, analytics, operational, compliance,
  document, financial, settings, profile, and notification data across pages.
- `FleetManagerReduxProvider.jsx` refreshes active cached data from one live-sync
  listener. Mutations invalidate every dependent screen after success.
- `FleetManagerDocumentDetails.jsx` resolves related records from cached lists.
  Authenticated file downloads remain direct so binary blobs stay outside Redux.

All four portals reuse the authenticated API transport. Forms, selected files,
confirmation dialogs, and geolocation controls remain component state.

Run the Redux regression tests from `front-end-react`:

```sh
node --test test/driverRedux.test.js
node --test test/businessClientRedux.test.js test/businessClientRender.test.js
node --test test/superuserRedux.test.js test/superuserRender.test.js
node --test test/fleetManagerRedux.test.js test/fleetManagerRender.test.js
```

`npm test` runs the full frontend suite. Redux and render tests use mocked API
responses; they do not create deliveries, review payments, or change live settings.
