# Balaji Studio on Cloudflare Workers

The deployment address is https://balaji-studio.gobinknightryder098.workers.dev.
The custom domain is connected only after the Worker passes live checks.

## Automatic deployments

Connect `knightryder098/cardetail` in Worker Settings → Builds.
Set the production branch to `master`. Disable preview/non-production builds.
Use root directory `/`, Node.js 24, build command `npm run build:worker`, and
deploy command `npm run deploy:worker`. Production builds should run tests and
type checking before the Worker build. The compiled Worker is then started
locally to verify that its session endpoint runs and rejects cross-origin
authentication requests before deployment. This check uses no production
database or email delivery. Cloudflare’s deployment token belongs
in its build settings, never in GitHub source or the application bundle.

Updates pushed or merged into `master` create a build and deploy on success.
Other branches must not have build triggers. A failed build must retain the
last successful deployment. An already-open browser tab may require a refresh
to load the new application version.

Next.js is pinned to 16.3.8 with OpenNext 1.20.10. Upgrade these together only
after checking adapter support and passing the compiled Worker runtime check;
a successful Next.js compilation alone does not confirm Worker compatibility.

## Runtime settings

`wrangler.jsonc` is the source of truth for `APP_MODE=live`, `APP_ORIGIN`,
the Hyperdrive binding, and compatibility flags. Store `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `OWNER_AUTH_USER_ID`, and `CRON_SECRET` as Worker
runtime secrets. These are separate from build variables. Do not upload
`.env.local`, database passwords, exported auth logs, or local database files.

The Worker reaches PostgreSQL through Hyperdrive. The configured resource
uses `verify-full`, the supplied database CA certificate, and disabled query
caching. The driver’s internal Hyperdrive proxy connection does not itself
perform origin TLS; Hyperdrive verifies the certificate and database hostname.
Do not replace origin verification with `require`, disable, or insecure TLS.
The non-secret `localConnectionString` is only for the deploy tool's local
Hyperdrive emulator. It never changes the production resource. Running a
local Worker preview requires an actual local PostgreSQL database.

The build scripts remove OpenNext’s embedded environment fallbacks and block
deployment if local environment files or configured private credentials are
found in output. Runtime secrets must never be build inputs.

## Live verification and remaining operations

Check the homepage, session endpoint, email verification, owner MFA login,
and a real booking before connecting the custom domain. Avoid repeated OTP
requests while testing; provider and application rate limits still apply.
Ensure `supabase/migrations/001_platform.sql` has been applied to the live DB.

The current application’s rate counters are held per Worker isolate, so they
are not a global abuse limit. Configure shared rate limiting before relying
on it for a high-traffic public release. Booking expiry requires a scheduler
calling POST `/api/v1/system/expire` with the private CRON_SECRET bearer token;
this deployment configuration does not install that scheduler. Email OTP is
provided by Supabase/SMTP2GO; notification outbox delivery and online payments
are separate implementation work.

For the later domain transition, update `APP_ORIGIN` to the exact custom-domain
HTTPS origin and, if retaining the workers.dev address, list that exact address
in `APP_ALLOWED_ORIGINS`. Also update Supabase’s Site URL and approved redirect
URLs. Do not use wildcard origins or forward arbitrary Host headers.
