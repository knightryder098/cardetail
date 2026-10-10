import { createClient } from '@supabase/supabase-js';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Session, State } from '@/lib/types';
import { AppError } from './errors';
import { isDemo, store } from './store';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function assertEnvironment(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  const external = new URL(`${url.protocol}//${host}`);
  if (isDemo() && !['localhost', '127.0.0.1', '[::1]'].includes(external.hostname)) throw new AppError('DEMO_LOCAL_ONLY', 'The demonstration is available only on this computer.', 403);
  let expectedOrigin = external.origin;
  if (!isDemo()) {
    if (!process.env.APP_ORIGIN) throw new AppError('ORIGIN_NOT_CONFIGURED', 'The live application origin is not configured.', 503);
    const entries = [process.env.APP_ORIGIN, ...(process.env.APP_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)];
    const approved = entries.map(value => {
      try {
        const parsed = new URL(value.trim());
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
        if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' || parsed.hostname.includes('*') || (parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:'))) throw new Error();
        return parsed;
      } catch { throw new AppError('ORIGIN_NOT_CONFIGURED', 'Configure an exact HTTPS application origin (HTTP is allowed only for local testing).', 503); }
    });
    const selected = approved.find(origin => origin.host === host);
    if (!selected) throw new AppError('ORIGIN_MISMATCH', 'Open the application using its configured website address.', 403);
    expectedOrigin = selected.origin;
  }
  const trustedJob = request.method==='POST' && url.pathname==='/api/v1/system/expire' && !!process.env.CRON_SECRET && request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`;
  if (!trustedJob && !['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== expectedOrigin) throw new AppError('INVALID_ORIGIN', 'This request must come from the application.', 403);
}
const rateBuckets = new Map<string, { n: number; until: number }>();
export function rateLimit(key: string, max = 20, window = 60000) {
  const now = Date.now(); if (rateBuckets.size > 5000) for (const [key, b] of rateBuckets) if (b.until < now) rateBuckets.delete(key);
  const b = rateBuckets.get(key); if (!b || b.until < now) { rateBuckets.set(key, { n: 1, until: now + window }); return; }
  if (++b.n > max) throw new AppError('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429);
}
function supabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new AppError('AUTH_NOT_CONFIGURED', 'Contact verification is awaiting provider setup.', 503);
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
function staffRole(s: State, userId: string) { return s.staff.find(m => m.active && m.userId === userId); }
export async function actorFromRequest(request: Request): Promise<Session | null> {
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('cd-session='))?.slice(11);
  if (!cookie) return null;
  const s = await store().read(); const actor = s.sessions.find(a => a.id === cookie && new Date(a.expiresAt).getTime() > Date.now());
  if (!actor) return null;
  if (isDemo()) return actor;
  if (!actor.accessToken) return null;
  const client = supabase();
  let { data, error } = await client.auth.getUser(actor.accessToken);
  let current = actor;
  if (error?.status === 401 && actor.refreshToken) {
    const refreshed = await client.auth.refreshSession({ refresh_token: actor.refreshToken });
    if (refreshed.error || !refreshed.data.session || refreshed.data.user?.id !== actor.customerId && !s.staff.some(m => m.id === actor.customerId && m.userId === refreshed.data.user?.id)) return null;
    const tokens = refreshed.data.session;
    ({ data, error } = await client.auth.getUser(tokens.access_token));
    if (error || !data.user || data.user.id !== refreshed.data.user?.id) return null;
    const saved = await store().transaction(state => {
      const existing = state.sessions.find(a => a.id === actor.id && new Date(a.expiresAt).getTime() > Date.now());
      if (!existing) return null;
      existing.accessToken = tokens.access_token; existing.refreshToken = tokens.refresh_token;
      return existing;
    });
    if (!saved) return null;
    current = saved;
  }
  if (error || !data.user) return null;
  const member = staffRole(s, data.user.id);
  return { ...current, customerId: member?.id ?? data.user.id, role: member?.role ?? 'customer', name: member?.name ?? current.name };
}
export function newSession(input: Partial<Session> & Pick<Session, 'email' | 'name' | 'customerId' | 'role'>): Session { return { id: randomUUID(), expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(), ...input }; }
export function linkManualBookings(s: State, verified: Session) {
  const manualId = `manual-${hash(verified.email).slice(0, 24)}`;
  for (const b of s.bookings) if (b.customerId === manualId && b.email === verified.email) b.customerId = verified.customerId;
  for (const p of s.packages) if (p.customerId === manualId) p.customerId = verified.customerId;
}
export async function requestVerification(input: { name: string; email: string; phone?: string }, shouldCreateUser = true) {
  rateLimit(`email:${hash(input.email)}`, 100, 3600000);
  const id = randomUUID(); const code = String(randomInt(100000, 999999));
  if (!isDemo()) { const { error } = await supabase().auth.signInWithOtp({ email: input.email, options: { shouldCreateUser } }); if (error) throw new AppError('VERIFICATION_DELIVERY_FAILED', 'We could not send a verification code. Try again later.', 503); }
  await store().transaction(s => { s.challenges = s.challenges.filter(c => new Date(c.expiresAt).getTime() > Date.now()); s.challenges.push({ id, email: input.email, name: input.name, phone: input.phone ?? '', digest: hash(`${id}:${code}`), expiresAt: new Date(Date.now() + 10 * 60000).toISOString(), attempts: 0 }); });
  return { challengeId: id, ...(isDemo() ? { demoCode: code } : {}) };
}
export async function confirmVerification(id: string, code: string): Promise<Session> {
  rateLimit(`verify:${id}`, 5, 600000);
  const challenge = await store().transaction(s => { const c = s.challenges.find(c => c.id === id && new Date(c.expiresAt).getTime() > Date.now()); if (!c || c.attempts >= 5) throw new AppError('VERIFICATION_EXPIRED', 'Request a new verification code.', 401); c.attempts++; return c; });
  let session: Session;
  if (isDemo()) { if (!timingSafeEqual(Buffer.from(challenge.digest), Buffer.from(hash(`${id}:${code}`)))) throw new AppError('INVALID_CODE', 'That code is incorrect. Please try again.', 401); session = newSession({ customerId: `demo-${hash(challenge.email).slice(0, 24)}`, name: challenge.name, email: challenge.email, role: 'customer' }); }
  else { const { data, error } = await supabase().auth.verifyOtp({ email: challenge.email, token: code, type: 'email' }); if (error || !data.user || !data.session) throw new AppError('INVALID_CODE', 'That code is incorrect or expired.', 401); session = newSession({ customerId: data.user.id, name: challenge.name, email: challenge.email, role: 'customer', accessToken: data.session.access_token, refreshToken: data.session.refresh_token }); }
  await store().transaction(s => { const existing = s.challenges.find(c => c.id === id); if (!existing) throw new AppError('VERIFICATION_EXPIRED', 'This code was already used.', 401); s.challenges = s.challenges.filter(c => c.id !== id); s.sessions = s.sessions.filter(a => new Date(a.expiresAt).getTime() > Date.now()); linkManualBookings(s, session); s.sessions.push(session); }); return session;
}
export async function demoOwner(): Promise<Session> { if (!isDemo()) throw new AppError('FORBIDDEN', 'Demo access is disabled.', 403); const session = newSession({ customerId: 'staff-owner', name: 'Studio owner', email: 'owner@example.com', role: 'owner', mfa: true }); await store().transaction(s => s.sessions.push(session)); return session; }
export async function adminPassword(email: string, password: string) {
  rateLimit(`password:${hash(email)}`, 5, 600000);
  const client = supabase(); const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new AppError('SIGN_IN_FAILED', 'Email or password is incorrect.', 401);
  const s = await store().read(); const member = staffRole(s, data.user.id);
  if (!member) throw new AppError('FORBIDDEN', 'This account does not have dashboard access.', 403);
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  if (factorError) throw new AppError('AUTH_UNAVAILABLE', 'Please try signing in again.', 503);
  const factorId = factors?.totp[0]?.id ?? null;
  const session = newSession({ customerId: member.id, name: member.name, email, role: member.role, accessToken: data.session.access_token, refreshToken: data.session.refresh_token, mfa: false });
  await store().transaction(s => s.sessions.push(session)); return { session, factorId };
}
export async function requestAdminSetup(email: string) {
  return requestVerification({ email, name: 'Studio team member' }, false);
}
async function adminClient(actor: Session) {
  if (isDemo() || !actor.accessToken || !actor.refreshToken) throw new AppError('FORBIDDEN', 'Sign in with your staff account first.', 403);
  const client = supabase();
  const { data, error } = await client.auth.getUser(actor.accessToken);
  const state = await store().read();
  const member = data.user && staffRole(state, data.user.id);
  if (error || !member) throw new AppError('FORBIDDEN', 'This account does not have dashboard access. Ask the owner to check Team & access.', 403);
  const restored = await client.auth.setSession({ access_token: actor.accessToken, refresh_token: actor.refreshToken });
  if (restored.error || !restored.data.session) throw new AppError('VERIFICATION_REQUIRED', 'Please sign in again.', 401);
  return { client, member };
}
export async function adminMfaStatus(actor: Session) {
  const { client } = await adminClient(actor);
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw new AppError('AUTH_UNAVAILABLE', 'Could not check your authenticator. Try again.', 503);
  return { factorId: data.totp[0]?.id ?? null };
}
export async function enrollAdminMfa(actor: Session) {
  const { client } = await adminClient(actor);
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  if (factorError) throw new AppError('AUTH_UNAVAILABLE', 'Could not check your authenticator. Try again.', 503);
  if (factors.totp.length) throw new AppError('MFA_ALREADY_ENROLLED', 'Use your existing authenticator to continue.', 409);
  // A cancelled setup must not fill the user's factor quota. Verified factors are never removed here.
  for (const factor of factors.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) {
    const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (removed.error) throw new AppError('MFA_SETUP_FAILED', 'Could not restart authenticator setup. Try again.', 503);
  }
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', issuer: 'Balaji Studio' });
  if (error || !data) throw new AppError('MFA_SETUP_FAILED', 'Could not create your authenticator setup. Try again.', 503);
  return { factorId: data.id, qrCode: data.totp.qr_code };
}
export async function setAdminPassword(actor: Session, password: string) {
  const { client, member } = await adminClient(actor);
  const { data: assurance, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !actor.mfa || assurance?.currentLevel !== 'aal2') throw new AppError('MFA_REQUIRED', 'Verify your authenticator before setting a password.', 403);
  const updated = await client.auth.updateUser({ password });
  if (updated.error || !updated.data.user || updated.data.user.id !== member.userId) throw new AppError('PASSWORD_SETUP_FAILED', 'Could not save your password. Use a strong password and try again.', 400);
  await store().transaction(s => { s.sessions = s.sessions.filter(a => a.id === actor.id || a.customerId !== member.id && a.customerId !== updated.data.user.id); });
  return { saved: true };
}
export async function confirmMfa(actor: Session, factorId: string, code: string) {
  rateLimit(`mfa:${actor.id}`, 5, 600000); if (!actor.accessToken || !actor.refreshToken) throw new AppError('FORBIDDEN', 'Please sign in again.', 401);
  const { client } = await adminClient(actor);
  const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code }); if (error || !data) throw new AppError('INVALID_CODE', 'The authenticator code is incorrect.', 401);
  return store().transaction(s => { const a = s.sessions.find(a => a.id === actor.id)!; a.accessToken = data.access_token; a.refreshToken = data.refresh_token; a.mfa = true; return a; });
}
export function sessionCookie(session: Session | null) { return `cd-session=${session?.id ?? ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${session ? 28800 : 0}${isDemo() ? '' : '; Secure'}`; }
