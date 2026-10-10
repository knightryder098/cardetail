import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
const errors = [];
if (config.vars?.APP_MODE !== 'live') errors.push('Set APP_MODE=live in wrangler.jsonc.');
try {
  const origin = new URL(config.vars?.APP_ORIGIN);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error();
} catch { errors.push('Set APP_ORIGIN to the exact HTTPS workers.dev address in wrangler.jsonc before deployment.'); }
const id = config.hyperdrive?.find(binding => binding.binding === 'HYPERDRIVE')?.id;
if (!/^[a-f0-9]{32}$/i.test(id ?? '') || /^0+$/.test(id)) errors.push('Replace the placeholder HYPERDRIVE ID with the verified Cloudflare resource ID.');
if (!fs.existsSync('.open-next/worker.js')) errors.push('Run npm run build:worker first.');
if (errors.length) { errors.forEach(error => console.error(error)); process.exit(1); }
console.log('Worker configuration is ready. Confirm required runtime secrets and Hyperdrive verify-full TLS before deploying.');
