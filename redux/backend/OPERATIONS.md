# Running DeliverSync

From `backend`, run `npm ci` and `npm run start:dev`. In a second terminal, run `npm ci` and `npm run dev` from `front-end-react`. Open the address printed by Vite. A new local checkout generates synthetic accounts from `demo/seed.cjs`. An existing local `data` directory supplies the initial demo snapshot if present. Later starts use `runtime-data`.

For environment-file configuration, copy `.env.example` to `.env`, fill it locally, run `npm run build`, then start `node --env-file=.env dist/main.js` from `backend`. Secrets belong in the backend environment. Build the web UI using `npm run build` in `front-end-react` and serve its `dist` folder with SPA fallback and a same-site reverse proxy for `/api`.

## Book, deliver and invoice a parcel

1. Configure a Twilio Verify service, an SMS-capable Messaging sender and the four `TWILIO_*` settings. The booking client enters the recipient's name, international phone number, optional alternate phone and instructions. The recipient receives a Verify SMS. The client enters the verification code to confirm that number for this booking.
2. Print the parcel label from business-client tracking. The assigned driver scans or enters its barcode at pickup. At handoff the driver requests a fresh SMS. Only legacy bookings without a phone use recipient email.
3. The recipient shares the six-digit code after receiving the whole parcel. The driver enters the booked name, barcode and code, and uploads proof. The ten-minute code has limited attempts. Resends require a minute between requests, with a maximum of five daily. A successful handoff records the invoice, proof and driver payout together.
4. For an unsuccessful attempt, the driver records the reason and evidence. In **Fleet Manager > Trips** the manager chooses an immediate or scheduled retry or a return to sender. A retry needs a fresh code. The driver confirms the physical return. Both decisions carry zero additional fee.
5. Manual payment submissions use an invoice, receipt and payment reference. Authorised reviewers can approve payment and record a full refund or chargeback in the ledger. Direct API callers can send an Idempotency-Key header for manual invoice and notification creation. Monthly settlements can be locked after the month ends and all earned driver payouts have been paid. Configure SMTP for sign-in verification and password resets. In verified-email mode an applicant first signs in to prove control of their inbox, then an administrator approves the account. In production, privileged financial actions require an email challenge verified within 15 minutes.

Twilio Verify checks the booking number and Twilio Messaging sends the handoff code. [Verification checks](https://www.twilio.com/docs/verify/api/verification-check) and [SMS message resources](https://www.twilio.com/docs/messaging/api/message-resource) describe the provider APIs.

## Configure dispatch and tracking

The demo prices named routes by their tariff kilometres. Set `DELIVERY_ROUTES_JSON` to a JSON array of objects with `id`, `label` and positive `km`. A fixed-depot route can also have `pickupPoint`, `dropPoint` (each contains numeric `latitude` and `longitude`), `arrivalRadiusM`, and `transitMinutes`. Supply measured route times and actual depot locations when available. A general service zone should omit fixed points. Estimated arrival appears at departure when the route has a duration. A reported fix can indicate proximity to a known drop. Custody still requires barcode, evidence and recipient verification.

Enter cargo bay measurements, capacity, supported handling and available routes in the fleet vehicle editor. Unmeasured vehicles cannot take dimensioned parcels automatically. An empty vehicle route list serves all configured routes. Optional daily shifts use immutable driver IDs and Indian local time, for example `DRIVER_SHIFTS_JSON={"DR-301":{"start":"08:00","end":"17:00"}}`. Overnight shifts are supported. Drivers without a configured shift use their recorded availability. Drivers can switch between Available and Unavailable from their dashboard. Assigned deliveries reserve the driver and display In Work until the assignment ends. Dispatch gives eligible drivers who have waited longest since their last assignment the first turn. Ties use fresh pickup proximity, recorded trip count and driver ID. If nobody qualifies, the delivery awaits manual dispatch.

The driver must grant browser location permission and keep the tracking page open. During a network interruption the page retains the latest sample in memory for up to ten minutes. Leaving the page or stopping sharing clears it. The UI marks a fix older than a minute as last known. Browser fixes have limited trust. ETA uses configured transit time and excludes live traffic.

## Private storage and recovery

Use one backend per JSON data directory. For production set `DATA_DIR`, `UPLOAD_DIR` and `LOG_DIR` on private persistent storage. The parent of `DATA_DIR` must be writable for the exclusive writer lock. If startup reports an existing lock, confirm on the host that its recorded process and any other writer have stopped before removing that particular lock file.

Use a unique `JWT_SECRET` of at least 32 bytes, an independent `DELIVERY_OTP_SECRET`, and a `DATA_ENCRYPTION_KEY` containing 64 hexadecimal digits. Keep a separate protected backup of the encryption key. JSON writes use authenticated encryption when configured. Use an encrypted volume for uploads, backups, logs and legacy plaintext files. Production upload scanning requires a working `CLAMSCAN_PATH` executable and current ClamAV signatures. Keep signatures updated on the deployment host.

Stop the backend before backing up the full data and upload directories together, including the commit journal and upload staging markers. Restore a backup to separate directories and use the same key. Start a single backend and verify readiness, a known delivery, its invoice and its proof download. Migration attributes legacy records only where ownership can be established. Review ambiguous legacy ownership from a trusted snapshot.

Expose the app over HTTPS. Configure `CORS_ORIGINS` for any separately hosted frontend. The production frontend build includes a CSP. Configure frame-ancestors and HTTPS headers on the static host. An optional backend container build is provided in `Dockerfile`. Mount a writable persistent parent at `/var/lib/deliversync` and supply an existing trusted dataset, environment secrets and current scanner signatures for production use.

## Verification and monitoring

Run `npm test -- --runInBand` and `npm run test:e2e -- --runInBand` in the backend. Run `npm test` in the frontend. For the handoff and three-role return browser workflows, build the backend, install Playwright Chromium using `npx playwright install chromium`, then run `npm run test:browser` from the frontend. Set `PLAYWRIGHT_CHANNEL=chrome` to run with locally installed Chrome. Tests use isolated data and simulated provider responses.

Monitor `/api/health` and `/api/health/ready`. Superusers can read `/api/health/metrics`. Set `LOG_JSON_STDOUT=true` to feed access, audit and error events to a log collector. Use the response request ID to correlate a failure. Operational trip notices appear in portal inboxes. SMS is used for recipient verification and handoff, and email for account challenges, resets and legacy handoffs.
