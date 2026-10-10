import { beforeEach, expect, it, vi } from 'vitest';
import type { Session, State } from '@/lib/types';
const m = vi.hoisted(() => ({ read: vi.fn(), transaction: vi.fn(), signInWithPassword: vi.fn(), signInWithOtp: vi.fn(), updateUser: vi.fn(), setSession: vi.fn(), getUser: vi.fn(), mfa: { listFactors: vi.fn(), enroll: vi.fn(), unenroll: vi.fn(), challengeAndVerify: vi.fn(), getAuthenticatorAssuranceLevel: vi.fn() } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: m }) }));
vi.mock('@/server/store', () => ({ isDemo: () => false, store: () => m }));
import { adminPassword, enrollAdminMfa, setAdminPassword, requestAdminSetup, confirmMfa } from '@/server/auth';
import { handleApi } from '@/server/api';
let state: State;
let actor: Session;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test');
  vi.stubEnv('APP_ORIGIN', 'https://studio.example');
  actor = { id: 'session', customerId: 'staff-owner', name: 'Owner', email: 'owner@example.com', role: 'owner', expiresAt: new Date(Date.now()+3600000).toISOString(), accessToken: 'access', refreshToken: 'refresh', mfa: false };
  state = { staff: [{ id: 'staff-owner', userId: 'owner-auth', role: 'owner', active: true }], sessions: [actor], challenges: [] } as unknown as State;
  m.read.mockResolvedValue(state); m.transaction.mockImplementation(async (fn: (s: State) => unknown) => fn(state));
  m.setSession.mockResolvedValue({ data: { session: { access_token: 'access', refresh_token: 'refresh' } }, error: null });
  m.getUser.mockResolvedValue({ data: { user: { id: 'owner-auth' } }, error: null });
  m.mfa.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
  m.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null });
});
it('lets a mapped password user proceed to enrollment without granting dashboard access', async () => {
  m.signInWithPassword.mockResolvedValue({ data: { user: { id: 'owner-auth' }, session: { access_token: 'access', refresh_token: 'refresh' } }, error: null });
  const result = await adminPassword('first@example.com', 'password');
  expect(result.factorId).toBeNull(); expect(result.session.mfa).toBe(false);
});
it('does not create new users when requesting staff setup', async () => {
  m.signInWithOtp.mockResolvedValue({ error: null });
  await requestAdminSetup('setup@example.com');
  expect(m.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ options: { shouldCreateUser: false } }));
});
it('rejects enrollment for an unmapped or revoked account', async () => {
  state.staff[0].active = false;
  await expect(enrollAdminMfa(actor)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(m.mfa.enroll).not.toHaveBeenCalled();
});
it('returns a private QR code only for a mapped account', async () => {
  m.mfa.enroll.mockResolvedValue({ data: { id: 'factor', totp: { qr_code: '<svg/>', secret: 'private', uri: 'otpauth://...' } }, error: null });
  expect(await enrollAdminMfa(actor)).toEqual({ factorId: 'factor', qrCode: '<svg/>', secret: 'private', uri: 'otpauth://...' });
});
it('does not replace a verified authenticator during password recovery', async () => {
  m.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'existing' }], all: [] }, error: null });
  await expect(enrollAdminMfa(actor)).rejects.toMatchObject({ code: 'MFA_ALREADY_ENROLLED' });
  expect(m.mfa.enroll).not.toHaveBeenCalled(); expect(m.mfa.unenroll).not.toHaveBeenCalled();
});
it('cleans up only abandoned unverified authenticator factors', async () => {
  m.mfa.listFactors.mockResolvedValue({ data: { totp: [], all: [{ id: 'abandoned', status: 'unverified', factor_type: 'totp' }] }, error: null });
  m.mfa.unenroll.mockResolvedValue({ error: null });
  m.mfa.enroll.mockResolvedValue({ data: { id: 'fresh', totp: { qr_code: '<svg/>' } }, error: null });
  await enrollAdminMfa(actor);
  expect(m.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'abandoned' });
});
it('does not mark a session verified when the authenticator code is wrong', async () => {
  m.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { code: 'invalid_code' } });
  await expect(confirmMfa(actor, 'bad-factor', '000000')).rejects.toMatchObject({ code: 'INVALID_CODE' });
  expect(actor.mfa).toBe(false);
});
it('requires provider-confirmed MFA before changing a password', async () => {
  actor.mfa = true;
  m.getUser.mockResolvedValue({ data: { user: { id: 'owner-auth' } }, error: null });
  await expect(setAdminPassword(actor, 'a-long-password')).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
  expect(m.updateUser).not.toHaveBeenCalled();
});
it('updates a password with the MFA session and invalidates other app sessions', async () => {
  actor.mfa = true;
  m.getUser.mockResolvedValue({ data: { user: { id: 'owner-auth' } }, error: null });
  m.mfa.getAuthenticatorAssuranceLevel = vi.fn().mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null });
  m.updateUser.mockResolvedValue({ data: { user: { id: 'owner-auth' } }, error: null });
  state.sessions.push({ ...actor, id: 'old' });
  await setAdminPassword(actor, 'a-long-password');
  expect(m.updateUser).toHaveBeenCalledWith({ password: 'a-long-password' });
  expect(state.sessions.map(s=>s.id)).toEqual(['session']);
});
it('blocks password setup over the API until MFA is complete', async () => {
  const response = await handleApi(new Request('https://studio.example/api/v1/auth/admin-password', { method: 'POST', headers: { origin: 'https://studio.example', cookie: 'cd-session=session' }, body: JSON.stringify({ password: 'long-test-password' }) }));
  expect(response.status).toBe(403);
  expect((await response.json()).error.code).toBe('MFA_REQUIRED');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(m.updateUser).not.toHaveBeenCalled();
});
it('returns the enrollment QR through a non-cacheable authenticated endpoint', async () => {
  m.mfa.enroll.mockResolvedValue({ data: { id: 'factor', totp: { qr_code: '<svg/>' } }, error: null });
  const response = await handleApi(new Request('https://studio.example/api/v1/auth/admin-mfa/enroll', { method: 'POST', headers: { origin: 'https://studio.example', cookie: 'cd-session=session' }, body: '{}' }));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ factorId: 'factor', qrCode: '<svg/>' });
});
