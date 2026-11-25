# Fleet and Driver Operations Management System

## Individual Contribution Submission

- **Name:** K. Srujan
- **Student ID:** S20240010116
- **GitHub:** srujank0512
- **Role:** Team Leader and Core Integration
- **Branch:** `feature/core-integration`

This archive contains the complete integrated application required to run and demonstrate my contribution. This README describes only my work.

## My Contribution

- Organized and integrated the complete full-stack project.
- Implemented application routing and protected role-based routes.
- Implemented authentication flow and session management with Context API.
- Integrated frontend API utilities and live backend synchronization.
- Developed shared components, hooks, layouts, navigation, and notification infrastructure.
- Developed login, registration, and public-facing pages.
- Integrated the NestJS backend, JSON persistence, repository configuration, and project documentation.
- Implemented delivery pricing based on actual weight and volumetric weight calculated from package dimensions.
- Synchronized the calculated delivery price across delivery, trip, portal, and invoice records.
- Configured tests and performed final integration, build, and regression verification.

## Primary Files Developed or Modified

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
front-end-react/src/pages/public/
front-end-react/test/session.test.js
front-end-react/package.json
front-end-react/vite.config.js
backend/src/common/delivery-pricing.ts
backend/src/common/delivery-pricing.spec.ts
backend/src/deliveries/
backend/src/transactions/
backend/src/data-store/
backend/
.gitignore
README.md
```

## Run the Project

Start the backend in the first terminal:

```bash
cd backend
npm install
npm run start:dev
```

Open a second terminal and start the frontend:

```bash
cd front-end-react
npm install
npm run dev
```

Each command starts only its own service. The backend runs on `http://localhost:3001` and the frontend normally runs on `http://localhost:5173`.

### Password-reset email configuration

The forgot-password screen displays its one-time code when the backend is not running in production, which keeps local demonstrations self-contained. For production, configure SMTP before starting the backend; reset codes are then sent by email and are never returned by the API.

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=DeliverSync <no-reply@example.com>
NODE_ENV=production
```

## Verification

```bash
cd backend
npm test -- --runInBand
npm run build

cd ../front-end-react
npm test
npm run build
```

Verified result for this snapshot: 46 backend tests and 27 frontend tests passed, and both production builds completed successfully.
