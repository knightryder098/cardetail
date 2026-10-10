import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { quoteSchema, holdSchema, contactSchema, verifySchema } from '@/lib/schema';
import { store, isDemo } from './store';
import { AppError, requireValue } from './errors';
import { actorFromRequest, adminPassword, adminMfaStatus, enrollAdminMfa, setAdminPassword, requestAdminSetup, assertEnvironment, confirmMfa, confirmVerification, demoOwner, rateLimit, requestVerification, sessionCookie } from './auth';
import { availableSlots, resolveQuote, resolvePackageQuote } from './domain';
import { changeBooking, confirmBooking, expireHolds, holdBooking, ownedBooking, packageBalance, rescheduleBooking } from './bookings';
import { projectPublic } from './public-data';
import { handleAdmin } from './admin-api';
import { currentBookingState } from './current-state';
export async function handleApi(request: Request): Promise<Response> {
  const requestId = randomUUID();
  try {
    assertEnvironment(request); const url = new URL(request.url); const path = url.pathname.replace(/^\/api\/v1\//, '');
    rateLimit(`path:${path.split('/')[0]}:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'}`, path.startsWith('public') ? 300 : 100);
    let body: unknown = {};
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) { const raw = await request.text(); if (raw.length > 500000) throw new AppError('PAYLOAD_TOO_LARGE', 'This request is too large.', 413); try { body = raw ? JSON.parse(raw) : {}; } catch { throw new AppError('VALIDATION_ERROR', 'A valid JSON request is required.'); } }
    const actor = await actorFromRequest(request);
    let response: Response | null = null;
    if (path === 'session' && request.method === 'GET') response = Response.json({ actor: actor ? { name: actor.name, email: actor.email, role: actor.role, mfa: actor.mfa } : null, demo: isDemo() });
    else if (path.startsWith('public/') && request.method === 'GET') { const data = projectPublic(await store().read()); response = Response.json(path === 'public/site' ? data : path === 'public/services' ? { services: data.catalogue.services } : path === 'public/vehicles' ? { vehicles: data.catalogue.vehicles } : path === 'public/packages' ? { plans: data.catalogue.plans } : { error: { code: 'NOT_FOUND' } }, { status: ['public/site', 'public/services', 'public/vehicles', 'public/packages'].includes(path) ? 200 : 404 }); }
    else if (path === 'auth/demo-owner' && request.method === 'POST') { const session = await demoOwner(); response = Response.json({ signedIn: true }); response.headers.set('Set-Cookie', sessionCookie(session)); }
    else if (path === 'auth/request-verification' && request.method === 'POST') response = Response.json(actor ? { signedIn: true, name: actor.name, email: actor.email } : await requestVerification(contactSchema.parse(body)));
    else if (path === 'auth/confirm-verification' && request.method === 'POST') { const input = verifySchema.parse(body); const session = await confirmVerification(input.challengeId, input.code); response = Response.json({ verified: true, name: session.name }); response.headers.set('Set-Cookie', sessionCookie(session)); }
    else if (path === 'auth/admin-login' && request.method === 'POST') { const input = z.object({ email: z.email().max(200), password: z.string().min(1).max(300) }).strict().parse(body); const result = await adminPassword(input.email, input.password); response = Response.json({ factorId: result.factorId, mfaRequired: true }); response.headers.set('Set-Cookie', sessionCookie(result.session)); }
    else if (path === 'auth/admin-setup/request' && request.method === 'POST') { const input = z.object({ email: z.email().max(200) }).strict().parse(body); response = Response.json(await requestAdminSetup(input.email)); }
    else if (path === 'auth/admin-mfa/status' && request.method === 'GET') response = Response.json(await adminMfaStatus(requireValue(actor, 'VERIFICATION_REQUIRED', 'Please verify your staff email first.')));
    else if (path === 'auth/admin-mfa/enroll' && request.method === 'POST') response = Response.json(await enrollAdminMfa(requireValue(actor, 'VERIFICATION_REQUIRED', 'Please sign in again.')));
    else if (path === 'auth/admin-password' && request.method === 'POST') { const input = z.object({ password: z.string().min(12).max(128) }).strict().parse(body); response = Response.json(await setAdminPassword(requireValue(actor, 'VERIFICATION_REQUIRED', 'Please sign in again.'), input.password)); }
    else if (path === 'auth/mfa' && request.method === 'POST') { const input = z.object({ factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).strict().parse(body); const session = await confirmMfa(requireValue(actor, 'VERIFICATION_REQUIRED', 'Please sign in again.'), input.factorId, input.code); response = Response.json({ verified: true }); response.headers.set('Set-Cookie', sessionCookie(session)); }
    else if (path === 'auth/logout' && request.method === 'POST') { if (actor) await store().transaction(s => { s.sessions = s.sessions.filter(a => a.id !== actor.id); }); response = Response.json({ signedOut: true }); response.headers.set('Set-Cookie', sessionCookie(null)); }
    else if (path === 'quotes' && request.method === 'POST') { const input = quoteSchema.parse(body); response = Response.json(await store().transaction(s => { const quote = resolveQuote(s, input); s.quotes = s.quotes.filter(q => new Date(q.expiresAt).getTime() > Date.now()); s.quotes.push(quote); return quote; }), { status: 201 }); }
    else if (path === 'availability' && request.method === 'GET') { const s = await store().read(); let q = s.quotes.find(q => q.id === url.searchParams.get('quoteId')); const bookingId = url.searchParams.get('bookingId'); if (bookingId) { if (!actor) throw new AppError('VERIFICATION_REQUIRED', 'Verify your contact to continue.', 401); q = ownedBooking(s, actor, bookingId).quote; } if (!q) throw new AppError('QUOTE_EXPIRED', 'Refresh your quote to continue.', 409); response = Response.json({ slots: availableSlots(s, q, url.searchParams.get('day') ?? '', new Date(), bookingId ?? undefined) }); }
    else if (/^packages\/[^/]+\/quote$/.test(path) && request.method === 'POST') { if (!actor) throw new AppError('VERIFICATION_REQUIRED', 'Verify your contact to use your pack.', 401); response = Response.json(await store().transaction(s => { const q = resolvePackageQuote(s, path.split('/')[1], actor.customerId); s.quotes = s.quotes.filter(q => new Date(q.expiresAt) > new Date()); s.quotes.push(q); return q; })); }
    else if (path === 'bookings/hold' && request.method === 'POST') { if (!actor) throw new AppError('VERIFICATION_REQUIRED', 'Verify your contact before reserving.', 401); const input = holdSchema.parse(body); const key = requireValue(request.headers.get('idempotency-key'), 'VALIDATION_ERROR', 'A retry key is required.'); response = Response.json(await store().transaction(s => holdBooking(s, { ...actor, role: 'customer' }, input, key)), { status: 201 }); }
    else if (/^bookings\/[^/]+\/confirm-manual$/.test(path) && request.method === 'POST') { if (!actor) throw new AppError('VERIFICATION_REQUIRED', 'Verify your contact to continue.', 401); response = Response.json(await store().transaction(s => confirmBooking(s, { ...actor, role: 'customer' }, path.split('/')[1]))); }
    else if (path.startsWith('me/')) {
      if (!actor) throw new AppError('VERIFICATION_REQUIRED', 'Verify your email to view your appointments.', 401);
      const s = await currentBookingState();
      if (path === 'me/bookings' && request.method === 'GET') response = Response.json({ bookings: s.bookings.filter(b => b.customerId === actor.customerId).sort((a, b) => b.startAt.localeCompare(a.startAt)), packages: s.packages.filter(p => p.customerId === actor.customerId).map(p => ({ ...p, balance: packageBalance(s, p.id) })) });
      else if (/^me\/bookings\/[^/]+$/.test(path) && request.method === 'GET') response = Response.json(ownedBooking(s, { ...actor, role: 'customer' }, path.split('/')[2]));
      else if (/^me\/bookings\/[^/]+\/cancel$/.test(path) && request.method === 'POST') { const input = z.object({ reason: z.string().max(250) }).strict().parse(body); response = Response.json(await store().transaction(s => changeBooking(s, { ...actor, role: 'customer' }, path.split('/')[2], 'cancelled', input.reason))); }
      else if (/^me\/bookings\/[^/]+\/reschedule$/.test(path) && request.method === 'POST') { const input = z.object({ startAt: z.iso.datetime() }).strict().parse(body); response = Response.json(await store().transaction(s => rescheduleBooking(s, { ...actor, role: 'customer' }, path.split('/')[2], input.startAt))); }
    }
    else if (path.startsWith('admin/')) response = await handleAdmin(request, path, actor, body);
    else if (path === 'system/expire' && request.method === 'POST') { if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) throw new AppError('FORBIDDEN', 'Job authentication required.', 403); await store().transaction(s => expireHolds(s)); response = Response.json({ done: true }); }
    if (!response) response = Response.json({ error: { code: 'NOT_FOUND', message: 'This endpoint is unavailable.', requestId } }, { status: 404 });
    response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('X-Request-Id', requestId); return response;
  } catch (error) {
    const e = error instanceof AppError ? error : error instanceof z.ZodError ? new AppError('VALIDATION_ERROR', error.issues.map(i => `${i.path.join('.') || 'Request'}: ${i.message}`).slice(0, 4).join('; ')) : error && typeof error === 'object' && 'code' in error && error.code === '23P01' ? new AppError('SLOT_UNAVAILABLE', 'That time was just booked. Choose another available time.', 409) : new AppError('SERVICE_UNAVAILABLE', 'This action is temporarily unavailable. Please try again.', 503);
    if (!(error instanceof AppError) && !(error instanceof z.ZodError)) console.error('Request failed', requestId, error instanceof Error ? error.name : 'Unknown error');
    return Response.json({ error: { code: e.code, message: e.message, requestId } }, { status: e.status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
