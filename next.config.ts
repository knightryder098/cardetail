import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = {
  ...(process.env.CLOUDFLARE_BUILD === '1' ? { output: 'standalone' as const } : {}),
  outputFileTracingExcludes: { '/*': ['./.env*', './.data/**', './supabase_logs.json', './gg.crt'] },
  serverExternalPackages: ['pg', 'exceljs'],
  ...(process.env.CLOUDFLARE_BUILD === '1' ? { webpack(config) {
      config.resolve.alias[path.resolve('src/server/sqlite-store.ts')] = path.resolve('src/server/sqlite-store.worker.ts');
    return config;
  } } satisfies Partial<NextConfig> : {}),
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') + "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" }
    ] }];
  }
};
export default config;
