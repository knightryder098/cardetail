import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ runtime: vi.fn(), query: vi.fn(), end: vi.fn(), connect: vi.fn(), pool: vi.fn() }));
vi.mock('@/server/worker-runtime', () => ({ getWorkerDatabase: mocks.runtime }));
vi.mock('pg', () => ({ Pool: class { constructor(options: unknown) { mocks.pool(options); } query = mocks.query; end = mocks.end; connect = mocks.connect; } }));
import { store } from '@/server/store';
beforeEach(() => { vi.clearAllMocks(); process.env.APP_MODE = 'live'; mocks.runtime.mockReturnValue({ connectionString: 'postgres://internal-proxy/test' }); mocks.end.mockResolvedValue(undefined); });
it('uses the Hyperdrive binding and closes the request pool after a read', async () => {
 mocks.query.mockResolvedValue({ rows: [{ payload: { marker: 'database' } }] });
 expect(await store().read()).toEqual({ marker: 'database' });
 expect(mocks.pool).toHaveBeenCalledWith(expect.objectContaining({ connectionString: 'postgres://internal-proxy/test', max: 1, ssl: false }));
 expect(mocks.end).toHaveBeenCalledOnce();
});
it('closes the pool when the database read fails', async () => {
 mocks.query.mockRejectedValue(new Error('database unavailable'));
 await expect(store().read()).rejects.toThrow('database unavailable'); expect(mocks.end).toHaveBeenCalledOnce();
});
it('closes the pool when acquiring a transaction connection fails', async () => {
 mocks.connect.mockRejectedValue(new Error('connection unavailable'));
 await expect(store().transaction(() => true)).rejects.toThrow('connection unavailable'); expect(mocks.end).toHaveBeenCalledOnce();
});
it('rejects demo persistence on Workers', () => { process.env.APP_MODE = 'demo'; expect(() => store()).toThrow('DEMO_MODE_NOT_SUPPORTED_ON_WORKERS'); });
