import fs from 'node:fs';

// OpenNext embeds .env files as runtime fallbacks. Cloudflare bindings must supply
// all server settings instead, including when a developer builds locally.
const file = '.open-next/cloudflare/next-env.mjs';
if (!fs.existsSync(file)) throw new Error('OpenNext environment module is missing; build before preparing runtime settings.');
fs.writeFileSync(file, 'export const production = {};\nexport const development = {};\nexport const test = {};\n');
console.log('Worker server settings will come exclusively from Cloudflare runtime bindings.');
