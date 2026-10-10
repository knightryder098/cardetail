# Balaji Studio

Balaji Studio is a runnable configuration-driven car detailing storefront and studio dashboard built from the supplied `car-detailing-config-platform` specification. It includes the public mobile booking journey, a private owner workspace, immutable published catalogue revisions, server-validated INR quotes, conflict-safe bay reservations, verified-contact ownership, pay-at-studio packages, a prepaid visit ledger, and Excel exports.

## Run the local demonstration

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001). The first local run creates `.data/demo.sqlite`. The local demonstration uses illustrative catalogue data and prices, shows the verification code in the booking screen, records no real messages or payments, and is restricted to loopback requests.

The storefront is at `/`; the owner workspace is at `/admin`. Choose **Open demo dashboard** to enter the owner workspace. The private saved-draft preview is `/preview` after signing in. The database can be reset for a clean demonstration by stopping the server and removing only `.data/demo.sqlite`.

## Checks

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

The browser suite needs Chromium. If Playwright does not find its managed browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local Chromium executable before running `npm run test:e2e`.

## Live configuration

Copy `.env.example` to `.env.local`, set `APP_MODE=live`, configure `APP_ORIGIN`, `DATABASE_URL`, Supabase Auth, `CRON_SECRET`, and the mapped owner authentication UUID, then apply `supabase/migrations/001_platform.sql` to the configured database. Live requests require the configured origin, Supabase contact verification, staff membership, and MFA. The PostgreSQL adapter is prepared for the first studio aggregate and its allocation/ledger constraints; it has not been connected to a client Supabase project in this workspace.

For first-time admin access, open `/admin` and choose **First-time setup / forgot password**. Use the existing mapped owner's email, verify the emailed code, scan and verify the authenticator QR code, then choose a password of at least 12 characters. Existing authenticator enrollment must be verified during password reset. Setup does not create users or grant staff roles; the account UUID must already match an active Team & access entry. `OWNER_AUTH_USER_ID` seeds the first owner and does not change an existing stored mapping.

Payment checkout is deliberately disabled. Manual collection is available to an owner in the dashboard. Notification events are recorded in the outbox, while a delivery worker and provider templates still need to be supplied. Replace the illustrative prices, contact details, products, policies, and legal copy before publishing a real studio catalogue.

See [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md) for the completed scope and the release work that remains.

For admin access and step-by-step hosting, database, email OTP, MFA, and release checks, see [docs/LIVE-DEPLOYMENT.md](docs/LIVE-DEPLOYMENT.md). Booking supports multiple treatments in one visit, with a combined server-calculated price and duration.
