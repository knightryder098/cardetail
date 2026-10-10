import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { State } from '@/lib/types';
import type { Store } from './store';
export class SqliteStore implements Store {
  readonly db: DatabaseSync;
  constructor(filename: string, initial: State) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename); this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS platform_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS allocations (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, retry_key TEXT NOT NULL, bay INTEGER NOT NULL, start_ms INTEGER NOT NULL, end_ms INTEGER NOT NULL, active INTEGER NOT NULL, UNIQUE(customer_id,retry_key));
      CREATE TRIGGER IF NOT EXISTS reject_overlap BEFORE INSERT ON allocations WHEN NEW.active=1 BEGIN SELECT RAISE(ABORT,'SLOT_UNAVAILABLE') WHERE EXISTS(SELECT 1 FROM allocations WHERE active=1 AND bay=NEW.bay AND start_ms<NEW.end_ms AND end_ms>NEW.start_ms); END;
      CREATE TABLE IF NOT EXISTS ledger (reference TEXT PRIMARY KEY, package_id TEXT NOT NULL, units INTEGER NOT NULL);`);
    this.db.prepare('INSERT OR IGNORE INTO platform_state(id,payload) VALUES(1,?)').run(JSON.stringify(initial));
  }
  async read(): Promise<State> { return JSON.parse((this.db.prepare('SELECT payload FROM platform_state WHERE id=1').get() as { payload: string }).payload); }
  async transaction<T>(fn: (s: State) => T): Promise<T> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const s: State = JSON.parse((this.db.prepare('SELECT payload FROM platform_state WHERE id=1').get() as { payload: string }).payload);
      const result = fn(s);
      this.db.exec('DELETE FROM allocations; DELETE FROM ledger;');
      const insert = this.db.prepare('INSERT INTO allocations VALUES(?,?,?,?,?,?,?)');
      for (const b of s.bookings) insert.run(b.id, b.customerId, b.idempotencyKey, b.bay, new Date(b.startAt).getTime(), new Date(b.blockedUntil).getTime(), ['held', 'confirmed', 'in_progress'].includes(b.status) ? 1 : 0);
      const entries = this.db.prepare('INSERT INTO ledger VALUES(?,?,?)'); for (const e of s.ledger) entries.run(e.reference, e.packageId, e.units);
      if (s.packages.some(p => s.ledger.filter(e => e.packageId === p.id).reduce((n, e) => n + e.units, 0) < 0)) throw new Error('ENTITLEMENT_BALANCE_NEGATIVE');
      this.db.prepare('UPDATE platform_state SET payload=? WHERE id=1').run(JSON.stringify(s)); this.db.exec('COMMIT'); return structuredClone(result);
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}
