import path from 'node:path';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import type { State } from '@/lib/types';
import { createState } from './seed';
import { SqliteStore } from './sqlite-store';
import { getWorkerDatabase } from './worker-runtime';
import { AppError } from './errors';
export { SqliteStore } from './sqlite-store';
export interface Store {
  read(): Promise<State>;
  transaction<T>(fn: (s: State) => T): Promise<T>;
  resolveAuthUser?(email: string, name: string): Promise<string | null>;
}
class PostgresStore implements Store {
  constructor(private workerConnection?: string) {}
  private createPool() {
    return new Pool({
      connectionString: this.workerConnection ?? process.env.DATABASE_URL,
      max: this.workerConnection ? 1 : 5,
      connectionTimeoutMillis: 10000,
      // The binding is an internal Hyperdrive proxy; origin TLS is configured on Hyperdrive.
      ssl: this.workerConnection ? false : process.env.DATABASE_SSL === 'disable' ? false : {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}),
      },
    });
  }
  async resolveAuthUser(email: string, name: string): Promise<string> {
    const pool = this.createPool();
    try {
      const cleanEmail = email.trim().toLowerCase();
      const findExisting = async (): Promise<string | null> => {
        try {
          const result = await pool.query('SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1', [cleanEmail]);
          return result.rows[0]?.id ?? null;
        } catch {
          throw new AppError('STAFF_ACCOUNT_LOOKUP_FAILED', 'Could not check the team member’s login account. Team changes were not saved; please try again.', 503);
        }
      };
      const existing = await findExisting();
      if (existing) return existing;

      // Auth owns account creation and its identities. Never insert auth.users directly.
      const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!process.env.SUPABASE_URL || !key) {
        throw new AppError('STAFF_AUTH_NOT_CONFIGURED', 'Creating team login accounts requires a private Supabase secret key on the server. Team changes were not saved.', 503);
      }
      const client = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const creationFailed = () => new AppError('STAFF_ACCOUNT_CREATION_FAILED', 'Could not create the team member’s login account. Team changes were not saved. Check the server’s Supabase Auth configuration and try again.', 503);
      let result;
      try {
        // The member must still prove email ownership in first-time setup.
        result = await client.auth.admin.createUser({ email: cleanEmail, email_confirm: false, user_metadata: { name } });
      } catch {
        throw creationFailed();
      }
      if (result.error) {
        // A customer signup or another owner may create the same email concurrently.
        if (['email_exists', 'user_already_exists'].includes(result.error.code ?? '')) {
          const concurrent = await findExisting();
          if (concurrent) return concurrent;
        }
        throw creationFailed();
      }
      if (!result.data.user?.id || result.data.user.email?.toLowerCase() !== cleanEmail) throw creationFailed();
      return result.data.user.id;
    } finally {
      await pool.end();
    }
  }
  async read(): Promise<State> {
    const pool = this.createPool();
    try { const r = await pool.query('SELECT payload FROM app_private.platform_state WHERE id=true'); return r.rows[0]?.payload ?? createState(false); }
    finally { await pool.end(); }
  }
  async transaction<T>(fn: (s: State) => T): Promise<T> {
    const pool = this.createPool();
    let db;
    try {
      db = await pool.connect();
      await db.query('BEGIN'); await db.query('INSERT INTO app_private.platform_state(id,payload) VALUES(true,$1) ON CONFLICT DO NOTHING', [JSON.stringify(createState(false))]);
      const r = await db.query('SELECT payload FROM app_private.platform_state WHERE id=true FOR UPDATE'); const s: State = r.rows[0].payload;
      const result = fn(s);
      await db.query('DELETE FROM app_private.allocations'); await db.query('DELETE FROM app_private.entitlement_ledger');
      for (const b of s.bookings) await db.query('INSERT INTO app_private.allocations(id,customer_id,retry_key,bay,occupied,active) VALUES($1,$2,$3,$4,tstzrange($5,$6,\'[)\'),$7)', [b.id, b.customerId, b.idempotencyKey, b.bay, b.startAt, b.blockedUntil, ['held', 'confirmed', 'in_progress'].includes(b.status)]);
      for (const e of s.ledger) await db.query('INSERT INTO app_private.entitlement_ledger(reference,package_id,units) VALUES($1,$2,$3)', [e.reference, e.packageId, e.units]);
      if (s.packages.some(p => s.ledger.filter(e => e.packageId === p.id).reduce((n, e) => n + e.units, 0) < 0)) throw new Error('ENTITLEMENT_BALANCE_NEGATIVE');
      await db.query('UPDATE app_private.platform_state SET payload=$1 WHERE id=true', [JSON.stringify(s)]); await db.query('COMMIT'); return structuredClone(result);
    } catch (e) { if (db) await db.query('ROLLBACK'); throw e; } finally { db?.release(); await pool.end(); }
  }
}
export const isDemo = () => process.env.APP_MODE === 'demo' || (!process.env.APP_MODE && process.env.NODE_ENV !== 'production');
const globalStore = globalThis as unknown as { crystalStore?: Store };
export function store(): Store {
  const worker = getWorkerDatabase();
  if (worker) {
    if (isDemo()) throw new Error('DEMO_MODE_NOT_SUPPORTED_ON_WORKERS');
    return new PostgresStore(worker.connectionString);
  }
  if (!globalStore.crystalStore) {
    if (isDemo()) globalStore.crystalStore = new SqliteStore(process.env.DEMO_DATABASE_PATH ?? path.join(process.cwd(), '.data', 'demo.sqlite'), createState(true));
    else if (process.env.DATABASE_URL) globalStore.crystalStore = new PostgresStore();
    else globalStore.crystalStore = { read: async () => createState(false), transaction: async () => { throw new Error('LIVE_DATABASE_NOT_CONFIGURED'); } };
  }
  return globalStore.crystalStore!;
}
