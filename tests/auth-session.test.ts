import { beforeEach, expect, it, vi } from 'vitest';
import type { Session, State } from '@/lib/types';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), refreshSession: vi.fn(), read: vi.fn(), transaction: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: mocks }) }));
vi.mock('@/server/store', () => ({ isDemo: () => false, store: () => mocks }));
import { actorFromRequest } from '@/server/auth';
let actor: Session;
let state: State;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-key');
  actor = { id: 'session-id', customerId: 'customer-id', name: 'Anita', email: 'anita@example.com', role: 'customer', expiresAt: new Date(Date.now() + 3600000).toISOString(), accessToken: 'expired-token', refreshToken: 'refresh-token' };
  state = { sessions: [actor], staff: [] } as unknown as State;
  mocks.read.mockResolvedValue(state);
  mocks.transaction.mockImplementation(async (fn: (s: State) => unknown) => fn(state));
});
const request = () => new Request('https://studio.example/api/v1/session', { headers: { cookie: 'cd-session=session-id' } });
it('refreshes expired provider credentials without extending the application session', async () => {
  mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 401, code: 'jwt_expired' } }).mockResolvedValueOnce({ data: { user: { id: 'customer-id' } }, error: null });
  mocks.refreshSession.mockResolvedValue({ data: { session: { access_token: 'fresh-token', refresh_token: 'rotated-token' }, user: { id: 'customer-id' } }, error: null });
  expect(await actorFromRequest(request())).toMatchObject({ name: 'Anita', accessToken: 'fresh-token', expiresAt: actor.expiresAt });
  expect(state.sessions[0].refreshToken).toBe('rotated-token');
});
it('does not revive an expired application session', async () => {
  actor.expiresAt = new Date(Date.now() - 1000).toISOString();
  expect(await actorFromRequest(request())).toBeNull();
  expect(mocks.refreshSession).not.toHaveBeenCalled();
});
it('rejects a refresh that changes the authenticated user', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
  mocks.refreshSession.mockResolvedValue({ data: { session: { access_token: 'fresh', refresh_token: 'rotated' }, user: { id: 'different-user' } }, error: null });
  expect(await actorFromRequest(request())).toBeNull();
  expect(mocks.transaction).not.toHaveBeenCalled();
});
