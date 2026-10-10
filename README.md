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

For first-time admin access, open `/admin` and choose **First-time setup / forgot password**. Use the existing mapped owner's email, verify the emailed code, scan and verify the authenticator QR code, then choose a password of at least 12 characters. Existing authenticator enrollment must be verified during password reset. Setup does not create users or grant staff roles. `OWNER_AUTH_USER_ID` seeds the first owner and does not change an existing stored mapping.

To add another owner, manager, or staff member, the signed-in owner opens **Team & access**, enters their name and email, selects a role, and clicks **Save team access**. Active members without a login mapping are linked to an existing Supabase account or created through the server-only Supabase Auth API. The account ID is returned by the server and displayed in a disabled field; it is never entered manually. New accounts remain email-unconfirmed until the member verifies their email. Saving does not send an email: the member opens `/admin`, chooses **First-time setup / forgot password**, verifies the emailed code, completes authenticator setup, and chooses their own password.

In Supabase **Authentication → Emails**, configure **both Confirm sign up and Magic link or OTP** to display `{{ .Token }}` instead of a confirmation link. A newly created, unconfirmed member uses the signup template; an existing confirmed member uses the magic-link/OTP template. Both must supply a code that can be entered into the application's setup form. See the [Supabase email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates).

Creating staff accounts requires `SUPABASE_SECRET_KEY` from the project's Supabase API Keys settings. Add it privately to `.env.local` for local live testing and to **Cloudflare → balaji-studio → Settings → Variables and Secrets** as an encrypted runtime secret named `SUPABASE_SECRET_KEY`. The legacy server-only `SUPABASE_SERVICE_ROLE_KEY` is also supported. Never use a `NEXT_PUBLIC_` prefix, commit this key, or put it in browser code, Wrangler plaintext variables, or build variables. Existing accounts can be linked without this key; creating new accounts fails clearly until it is configured. Team changes are saved only after account provisioning succeeds. If an account was created before a later team-save failure, retrying reuses it without resetting its password or authenticator.

Payment checkout is deliberately disabled. Manual collection is available to an owner in the dashboard. Notification events are recorded in the outbox, while a delivery worker and provider templates still need to be supplied. Replace the illustrative prices, contact details, products, policies, and legal copy before publishing a real studio catalogue.

See [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md) for the completed scope and the release work that remains.

For admin access and step-by-step hosting, database, email OTP, MFA, and release checks, see [docs/LIVE-DEPLOYMENT.md](docs/LIVE-DEPLOYMENT.md). Booking supports multiple treatments in one visit, with a combined server-calculated price and duration.
