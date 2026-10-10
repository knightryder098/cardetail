import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ query: vi.fn(), end: vi.fn(), createUser: vi.fn(), createClient: vi.fn() }));
vi.mock('pg', () => ({ Pool: class { query = m.query; end = m.end; } }));
vi.mock('@/server/worker-runtime', () => ({ getWorkerDatabase: () => null }));
vi.mock('@supabase/supabase-js', () => ({ createClient: m.createClient }));
import { store } from '@/server/store';

const authId = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  vi.resetAllMocks();
  delete (globalThis as { crystalStore?: unknown }).crystalStore;
  vi.stubEnv('APP_MODE', 'live');
  vi.stubEnv('DATABASE_URL', 'postgres://local:local@localhost/test');
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'private-test-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  m.query.mockResolvedValue({ rows: [] });
  m.createClient.mockReturnValue({ auth: { admin: { createUser: m.createUser } } });
  m.createUser.mockResolvedValue({ data: { user: { id: authId, email: 'staff@example.com' } }, error: null });
});

it('creates an Auth account through Supabase and returns its ID without writing auth tables', async () => {
  expect(await store().resolveAuthUser!(' STAFF@example.com ', 'New Staff')).toBe(authId);
  expect(m.createUser).toHaveBeenCalledWith({ email: 'staff@example.com', email_confirm: false, user_metadata: { name: 'New Staff' } });
  expect(m.createClient).toHaveBeenCalledWith('https://test.supabase.co', 'private-test-key', expect.objectContaining({ auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }) }));
  expect(m.query.mock.calls.every(([sql]) => /^SELECT /i.test(sql))).toBe(true);
  expect(m.end).toHaveBeenCalled();
});

it('reuses an existing account without changing its password or profile', async () => {
  m.query.mockResolvedValue({ rows: [{ id: authId }] });
  vi.stubEnv('SUPABASE_SECRET_KEY', '');
  expect(await store().resolveAuthUser!('staff@example.com', 'New Staff')).toBe(authId);
  expect(m.createUser).not.toHaveBeenCalled();
});

it('reports missing private server configuration instead of returning an unmapped user', async () => {
  vi.stubEnv('SUPABASE_SECRET_KEY', '');
  await expect(store().resolveAuthUser!('staff@example.com', 'Staff')).rejects.toMatchObject({ code: 'STAFF_AUTH_NOT_CONFIGURED', status: 503 });
  expect(m.createUser).not.toHaveBeenCalled();
});

it('does not expose provider messages or credentials when creation fails', async () => {
  m.createUser.mockResolvedValue({ data: { user: null }, error: { code: 'unexpected_failure', message: 'Sensitive provider details' } });
  await expect(store().resolveAuthUser!('staff@example.com', 'Staff')).rejects.toMatchObject({ code: 'STAFF_ACCOUNT_CREATION_FAILED', status: 503 });
  await expect(store().resolveAuthUser!('staff@example.com', 'Staff')).rejects.not.toHaveProperty('message', expect.stringContaining('Sensitive provider details'));
});

it('supports the legacy server-only service role key', async () => {
  vi.stubEnv('SUPABASE_SECRET_KEY', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'private-legacy-test-key');
  expect(await store().resolveAuthUser!('staff@example.com', 'Staff')).toBe(authId);
  expect(m.createClient).toHaveBeenCalledWith('https://test.supabase.co', 'private-legacy-test-key', expect.any(Object));
});

it('rejects a provider response for a different email', async () => {
  m.createUser.mockResolvedValue({ data: { user: { id: authId, email: 'different@example.com' } }, error: null });
  await expect(store().resolveAuthUser!('staff@example.com', 'Staff')).rejects.toMatchObject({ code: 'STAFF_ACCOUNT_CREATION_FAILED' });
});

it('reuses an account created concurrently when the provider reports an existing email', async () => {
  m.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: authId }] });
  m.createUser.mockResolvedValue({ data: { user: null }, error: { code: 'email_exists' } });
  expect(await store().resolveAuthUser!('staff@example.com', 'Staff')).toBe(authId);
  expect(m.createUser).toHaveBeenCalledTimes(1);
});

it('does not silently save when the account lookup fails', async () => {
  m.query.mockRejectedValue(new Error('Database credentials or connection details'));
  await expect(store().resolveAuthUser!('staff@example.com', 'Staff')).rejects.toMatchObject({ code: 'STAFF_ACCOUNT_LOOKUP_FAILED', status: 503 });
  expect(m.createUser).not.toHaveBeenCalled();
});
