# Fleet and Driver Operations Management System

A full-stack logistics application for managing deliveries, drivers, vehicles, trips, maintenance, payments, and users through separate role-based portals.

## Main Functionalities

- Role-based registration and login
- Protected routes for four user roles
- Delivery creation, cancellation, and tracking
- Driver and vehicle management
- Trip assignment and status updates
- Proof of Delivery and issue reporting
- Maintenance and compliance management
- Invoices, payments, and notifications
- User, role, permission, and system administration

## Technologies and Dependencies

### Frontend

- React
- React DOM
- React Router
- TanStack React Query
- Vite
- JavaScript
- CSS

### Backend

- NestJS
- TypeScript
- JWT authentication
- bcrypt
- Class Validator
- Jest
- JSON file persistence

## Project Structure

```text
project/
├── backend/
├── front-end-react/
├── .gitignore
└── README.md
```

## Runtime Data Source Policy

- All users, approvals, vehicles, drivers, trips, deliveries, maintenance records, documents, payments, notifications, dashboard metrics, and settings must be loaded from the backend API.
- Frontend pages must not contain mock records, fallback business data, or hardcoded operational statistics.
- Empty arrays and placeholder text may be used only for loading, empty, and error states. Select options that represent validated backend enums are UI configuration, not records.
- Backend JSON files are the current persistence layer and remain the authoritative runtime data source.

## Installation

### Backend

```bash
cd backend
npm install
```

### Frontend

Open another terminal from the project root:

```bash
cd front-end-react
npm install
```

## Running the Project

### Recommended: Start Everything Together

From the frontend directory, one command starts the backend, waits for port 3001
to be ready, and then starts Vite:

```bash
cd front-end-react
npm run dev
```

If the backend is already running, the command reuses it instead of starting a
duplicate process. Stop both managed services together with `Ctrl+C`.

### Manual: Start in Separate Terminals

Start the backend in the first terminal:

```bash
cd backend
npm run start:dev
```

The backend runs at:

```text
http://localhost:3001
```

Open another terminal and start only the frontend:

```bash
cd front-end-react
npm run dev:frontend
```

Open the URL displayed by Vite, normally:

```text
http://localhost:5173
```

## Production Build

### Backend

```bash
cd backend
npm run build
```

### Frontend

```bash
cd front-end-react
npm run build
```

## Testing Instructions

### Backend Tests

```bash
cd backend
npm test -- --runInBand
```

Expected result:

```text
Test Suites: 2 passed
Tests: 4 passed
```

### Frontend Tests

```bash
cd front-end-react
npm test
```

### Manual Testing

1. Start the backend and frontend.
2. Register or log in with a supported role.
3. Create a delivery using the Business Client portal.
4. Manage drivers and vehicles using the Fleet Manager portal.
5. Assign a driver and vehicle to delivery work.
6. Update the trip status using the Driver portal.
7. Submit Proof of Delivery.
8. View delivery status and invoices.
9. Manage users and permissions using the Superuser portal.

# Team Contributions

## 1. K. Srujan — Team Leader

```text
Student ID: [S20240010116]
GitHub Username: srujank0512
Branch: feature/core-integration
```

### Contribution

- Organized and integrated the complete project
- Implemented application routing
- Integrated authentication and protected routes
- Implemented session management using Context API
- Integrated frontend API utilities
- Developed shared components and custom hooks
- Integrated common portal layouts
- Developed login, registration, and public pages
- Configured frontend testing
- Integrated backend, repository configuration, and documentation
- Performed final build and integration testing

### Files Developed or Modified

```text
front-end-react/src/App.jsx
front-end-react/src/main.jsx
front-end-react/src/index.css
front-end-react/src/api/client.js
front-end-react/src/api/liveUpdates.js
front-end-react/src/api/namespaces.js
front-end-react/src/auth/RequireRole.jsx
front-end-react/src/auth/SessionContext.jsx
front-end-react/src/components/BrandLogo.jsx
front-end-react/src/components/Icon.jsx
front-end-react/src/components/Modal.jsx
front-end-react/src/components/NotificationInbox.jsx
front-end-react/src/components/NotificationInbox.css
front-end-react/src/components/StatusPill.jsx
front-end-react/src/hooks/useLiveSync.js
front-end-react/src/hooks/useNotificationBadge.js
front-end-react/src/hooks/usePageHeader.jsx
front-end-react/src/hooks/usePortalStyles.js
front-end-react/src/hooks/useToast.jsx
front-end-react/src/layouts/BusinessClientLayout.jsx
front-end-react/src/layouts/DriverLayout.jsx
front-end-react/src/layouts/FleetManagerLayout.jsx
front-end-react/src/layouts/SuperuserLayout.jsx
front-end-react/src/pages/auth/Login.jsx
front-end-react/src/pages/public/Home.jsx
front-end-react/src/pages/public/About.jsx
front-end-react/src/pages/public/Roles.jsx
front-end-react/src/pages/public/RegisterBusinessClient.jsx
front-end-react/src/pages/public/RegisterDriver.jsx
front-end-react/src/pages/public/RegisterFleetManager.jsx
front-end-react/test/session.test.js
front-end-react/package.json
front-end-react/vite.config.js
backend/
.gitignore
README.md
```


---

## 2. T. GRANTHIK — Business Client Portal

```text
Student ID: [S20240010240]
GitHub Username: [Granthik6]
Branch: feature/business-client
```

### Contribution

- Developed the Business Client dashboard
- Implemented the controlled delivery creation form
- Implemented delivery form validation
- Developed active and completed delivery views
- Added delivery cancellation
- Added live delivery tracking
- Developed invoice and payment pages
- Added feedback and profile management
- Added Business Client portal styling

### Files Developed or Modified

```text
front-end-react/src/pages/business-client/BcDashboard.jsx
front-end-react/src/pages/business-client/BcCreateDelivery.jsx
front-end-react/src/pages/business-client/BcActiveDeliveries.jsx
front-end-react/src/pages/business-client/BcActiveDeliveries.css
front-end-react/src/pages/business-client/BcCompletedDeliveries.jsx
front-end-react/src/pages/business-client/BcCancelOrder.jsx
front-end-react/src/pages/business-client/BcLiveTracking.jsx
front-end-react/src/pages/business-client/BcInvoices.jsx
front-end-react/src/pages/business-client/BcInvoiceView.jsx
front-end-react/src/pages/business-client/BcSubmitTransaction.jsx
front-end-react/src/pages/business-client/BcFeedback.jsx
front-end-react/src/pages/business-client/BcProfile.jsx
front-end-react/src/pages/business-client/BcNotifications.jsx
front-end-react/src/pages/business-client/bcUtils.js
front-end-react/src/pages/business-client/deliverySummary.js
front-end-react/src/pages/business-client/useBcCurrentUser.js
front-end-react/public/assets/css/business-client.css
```


---

## 3. K.TARUN — Fleet Manager Portal

```text
Student ID: [S20240010100]
GitHub Username: [TarunKallepalli]
Branch: feature/fleet-manager
```

### Contribution

- Developed the Fleet Manager dashboard
- Implemented vehicle management
- Implemented driver management
- Added driver profiles and compliance
- Added trip assignment and live tracking
- Added maintenance scheduling
- Added document management
- Added fleet analytics, settings, and profile
- Added Fleet Manager portal styling

### Files Developed or Modified

```text
front-end-react/src/pages/fleet-manager/ActionMenu.jsx
front-end-react/src/pages/fleet-manager/FmDashboard.jsx
front-end-react/src/pages/fleet-manager/FmVehicles.jsx
front-end-react/src/pages/fleet-manager/FmAddVehicle.jsx
front-end-react/src/pages/fleet-manager/FmEditVehicle.jsx
front-end-react/src/pages/fleet-manager/FmDrivers.jsx
front-end-react/src/pages/fleet-manager/FmAddDriver.jsx
front-end-react/src/pages/fleet-manager/FmEditDriver.jsx
front-end-react/src/pages/fleet-manager/FmDriverProfile.jsx
front-end-react/src/pages/fleet-manager/FmCompliance.jsx
front-end-react/src/pages/fleet-manager/FmTrips.jsx
front-end-react/src/pages/fleet-manager/FmLiveTracking.jsx
front-end-react/src/pages/fleet-manager/FmMaintenance.jsx
front-end-react/src/pages/fleet-manager/FmScheduleMaintenance.jsx
front-end-react/src/pages/fleet-manager/FmDocuments.jsx
front-end-react/src/pages/fleet-manager/FmUploadDocument.jsx
front-end-react/src/pages/fleet-manager/FmAnalytics.jsx
front-end-react/src/pages/fleet-manager/FmProfile.jsx
front-end-react/src/pages/fleet-manager/FmSettings.jsx
front-end-react/src/pages/fleet-manager/FmNotifications.jsx
front-end-react/src/pages/fleet-manager/fmUtils.js
front-end-react/public/assets/css/fleet-manager.css
```


---

## 4. D. HARSHAVEER — Driver Portal

```text
Student ID: [S20240010061]
GitHub Username: [IIIT-Harshaveer]
Branch: feature/driver-portal
```

### Contribution

- Developed the Driver dashboard
- Implemented assigned tasks and task details
- Added trip-status workflow
- Added driver map and location updates
- Developed trip history
- Added Proof of Delivery
- Added issue reporting
- Added driver earnings and profile
- Added notifications and messages
- Added driver status tests
- Added Driver portal styling

### Files Developed or Modified

```text
front-end-react/src/pages/driver/DriverDashboard.jsx
front-end-react/src/pages/driver/DriverTasks.jsx
front-end-react/src/pages/driver/DriverTaskDetails.jsx
front-end-react/src/pages/driver/DriverMap.jsx
front-end-react/src/pages/driver/DriverHistory.jsx
front-end-react/src/pages/driver/DriverProofOfDelivery.jsx
front-end-react/src/pages/driver/DriverReportIssue.jsx
front-end-react/src/pages/driver/DriverEarnings.jsx
front-end-react/src/pages/driver/DriverProfile.jsx
front-end-react/src/pages/driver/DriverNotifications.jsx
front-end-react/src/pages/driver/DriverMessages.jsx
front-end-react/src/pages/driver/tripStatus.js
front-end-react/src/components/TripPosition.jsx
front-end-react/test/dashboard-status.test.js
front-end-react/public/assets/css/driver-desktop.css
```

---

## 5. P.KOUSHIIK — Superuser Portal

```text
Student ID: [S20240010174]
GitHub Username: [Koushik276]
Branch: feature/superuser
```

### Contribution

- Developed the Superuser dashboard
- Implemented user creation and editing
- Added user status management
- Added role and permission management
- Added system configuration
- Added reports and monitoring
- Added delivery, trip, vehicle, and maintenance views
- Added transactions and document management
- Added Superuser profile and notifications
- Added Superuser portal styling

### Files Developed or Modified

```text
front-end-react/src/pages/superuser/SuDashboard.jsx
front-end-react/src/pages/superuser/SuManageUsers.jsx
front-end-react/src/pages/superuser/SuUserForm.jsx
front-end-react/src/pages/superuser/SuRoles.jsx
front-end-react/src/pages/superuser/SuSystemConfiguration.jsx
front-end-react/src/pages/superuser/SuReports.jsx
front-end-react/src/pages/superuser/SuDeliveryRequests.jsx
front-end-react/src/pages/superuser/SuTripMonitoring.jsx
front-end-react/src/pages/superuser/SuVehicles.jsx
front-end-react/src/pages/superuser/SuMaintenance.jsx
front-end-react/src/pages/superuser/SuScheduleMaintenance.jsx
front-end-react/src/pages/superuser/SuTransactions.jsx
front-end-react/src/pages/superuser/SuDocuments.jsx
front-end-react/src/pages/superuser/SuProfile.jsx
front-end-react/src/pages/superuser/SuNotifications.jsx
front-end-react/public/assets/css/superuser.css
```
