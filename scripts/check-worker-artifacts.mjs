import fs from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const names = ['DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'CRON_SECRET'];
const secrets = names.map(name => process.env[name]).filter(value => value && value.length >= 8);
if (process.env.DATABASE_URL) {
 const password = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
 if (password.length >= 8) secrets.push(password);
}
const failures = [];
function scan(directory) {
 for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
  const file = path.join(directory, entry.name);
  if (entry.isDirectory()) { scan(file); continue; }
  if (!entry.isFile()) continue;
  if (/^\.env|^\.dev\.vars|supabase_logs|^gg\.crt$/.test(entry.name)) failures.push(file);
  const contents = fs.readFileSync(file);
  if (secrets.some(secret => contents.includes(Buffer.from(secret)))) failures.push(file);
 }
}
for (const directory of ['.open-next', '.next/standalone']) if (fs.existsSync(directory)) scan(directory);
if (failures.length) { console.error('Private deployment data found in build artifacts. Deployment blocked.'); process.exit(1); }
console.log('Build artifacts contain no local environment files or configured private credentials.');
