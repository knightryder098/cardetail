import type { State } from '@/lib/types';
import type { Store } from './store';

// Worker builds never import node:sqlite or read a local demo database.
export class SqliteStore implements Store {
  constructor(_filename: string, _initial: State) { throw new Error('DEMO_MODE_NOT_SUPPORTED_ON_WORKERS'); }
  async read(): Promise<State> { throw new Error('DEMO_MODE_NOT_SUPPORTED_ON_WORKERS'); }
  async transaction<T>(_fn: (state: State) => T): Promise<T> { throw new Error('DEMO_MODE_NOT_SUPPORTED_ON_WORKERS'); }
}
