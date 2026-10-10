import path from 'node:path';
import { Pool } from 'pg';
import type { State } from '@/lib/types';
import { createState } from './seed';
import { SqliteStore } from './sqlite-store';
import { getWorkerDatabase } from './worker-runtime';
export { SqliteStore } from './sqlite-store';
export interface Store {
  read(): Promise<State>;
  transaction<T>(fn: (s: State) => T): Promise<T>;
  resolveAuthUser?(email: string): Promise<string | null>;
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
  async resolveAuthUser(email: string): Promise<string | null> {
    const pool = this.createPool();
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) return null;
      const existing = await pool.query('SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1', [cleanEmail]);
      if (existing.rows[0]?.id) return existing.rows[0].id;
      const inserted = await pool.query(
        `INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
          $1, '', now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
        ) ON CONFLICT (email) DO UPDATE SET updated_at = now() RETURNING id`,
        [cleanEmail]
      );
      return inserted.rows[0]?.id ?? null;
    } catch (err) {
      console.error('Failed to resolve auth user', email, err);
      return null;
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
