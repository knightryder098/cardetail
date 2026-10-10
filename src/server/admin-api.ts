import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import type { Booking, Quote, Session, Staff, State } from '@/lib/types';
import { catalogueSchema, quoteSchema } from '@/lib/schema';
import { localDay } from '@/lib/format';
import { store, isDemo } from './store';
import { currentBookingState } from './current-state';
import { AppError, requireValue } from './errors';
import { authorize } from './authorization';
import { audit, changeBooking, confirmBooking, holdBooking, ownedBooking, packageBalance, recordPayment, rescheduleBooking } from './bookings';
import { resolveQuote, validatePublication } from './domain';
import { exportWorkbook } from './reports';
export function presentBooking(b: Booking, actor: Session): Booking {
    if (actor.role !== 'staff') return b;
    const copy = structuredClone(b); copy.email = copy.email.replace(/^([^@])[^@]*(@.*)$/, '$1…$2'); copy.phone = copy.phone ? '••••' + copy.phone.slice(-4) : '';
    const redact = (quote: Quote) => {
      quote.totalPaise = 0; quote.taxPaise = 0; quote.subtotalPaise = 0; quote.snapshot.service.tiers = [];
      quote.snapshot.tier.prices = { standard: { one_time: null, monthly: null, annual: null }, premium: { one_time: null, monthly: null, annual: null }, luxury: { one_time: null, monthly: null, annual: null } };
      quote.items?.forEach(redact);
    };
    redact(copy.quote); return copy;
}
export function adminData(s: State, actor: Session) {
  const privileged = actor.role !== 'staff';
  const bookings = s.bookings.filter(b => privileged || b.staffId === actor.customerId).map(b => presentBooking(b, actor));
  return { draft: privileged ? s.draft : null, draftVersion: s.draftVersion ?? 0, activeRevisionId: s.activeRevisionId, draftBaseRevisionId: s.draftBaseRevisionId, revisions: privileged ? s.revisions.map(r => ({ id: r.id, number: r.number, at: r.at, author: r.author })) : [], bookings, packages: privileged ? s.packages.map(p => ({ ...p, balance: packageBalance(s, p.id) })) : [], staff: actor.role === 'owner' ? s.staff : s.staff.map(m => ({ id: m.id, name: m.name, role: m.role, active: m.active, email: '', userId: null })), audit: actor.role === 'owner' ? s.audit.slice(-100).reverse() : [], outbox: actor.role === 'owner' ? s.outbox.slice(-50).reverse() : [] };
}
export function validateStaffAccess(staff: Staff[], live: boolean) {
  if (new Set(staff.map(m => m.id)).size !== staff.length || new Set(staff.filter(m => m.userId).map(m => m.userId)).size !== staff.filter(m => m.userId).length)
    throw new AppError('VALIDATION_ERROR', 'Team identifiers and authentication mappings must be unique.');
  if (new Set(staff.filter(m => m.active).map(m => m.email.toLowerCase())).size !== staff.filter(m => m.active).length)
    throw new AppError('VALIDATION_ERROR', 'Team member email addresses must be unique.');
  if (!staff.some(m => m.active && m.role === 'owner' && (!live || m.userId)))
    throw new AppError('LAST_OWNER', 'Keep at least one active mapped owner.');
}
export async function handleAdmin(request: Request, path: string, actor: Session | null, body: unknown): Promise<Response | null> {
  const s = await currentBookingState(); const a = authorize(s, actor, 'admin.read'); const url = new URL(request.url);
  if (path === 'admin/data' && request.method === 'GET') return Response.json(adminData(s, a));
  if (path === 'admin/preview' && request.method === 'GET') { authorize(s, a, 'catalog.write'); return Response.json({ catalogue: s.draft, draftVersion: s.draftVersion ?? 0 }); }
  if (path === 'admin/catalogue' && request.method === 'PUT') {
    authorize(s, a, 'catalog.write'); const input = z.object({ catalogue: catalogueSchema, baseRevisionId: z.string().nullable(), draftVersion: z.number().int().nonnegative() }).strict().parse(body);
    return Response.json(await store().transaction(s => { if (s.activeRevisionId !== input.baseRevisionId || (s.draftVersion ?? 0) !== input.draftVersion) throw new AppError('REVISION_CONFLICT', 'Another editor changed the catalogue. Reload before saving.', 409); s.draft = input.catalogue; s.draftVersion = input.draftVersion + 1; s.draftBaseRevisionId = input.baseRevisionId; audit(s, a.name, 'catalogue.draft_saved', 'Draft saved; public content unchanged'); return { saved: true, draftVersion: s.draftVersion, warnings: s.bookings.some(b => ['confirmed', 'in_progress'].includes(b.status)) ? ['Existing appointments retain their original times and prices. Review the calendar before changing hours or capacity.'] : [] }; }));
  }
  if (path === 'admin/publish' && request.method === 'POST') {
    authorize(s, a, 'catalog.publish'); const input = z.object({ baseRevisionId: z.string().nullable(), draftVersion: z.number().int().nonnegative() }).strict().parse(body);
    return Response.json(await store().transaction(s => { if (s.activeRevisionId !== input.baseRevisionId || s.draftBaseRevisionId !== input.baseRevisionId || (s.draftVersion ?? 0) !== input.draftVersion) throw new AppError('REVISION_CONFLICT', 'Another editor changed the draft. Reload before publishing.', 409); const errors = validatePublication(s.draft); if (s.bookings.some(b => ['confirmed', 'in_progress'].includes(b.status) && new Date(b.blockedUntil) > new Date() && b.bay > s.draft.schedule.bays)) errors.push('Reschedule appointments in removed bays before reducing studio capacity.'); if (errors.length) throw new AppError('PUBLICATION_INVALID', errors.slice(0, 8).join(' '), 422); const r = { id: randomUUID(), number: (s.revisions.at(-1)?.number ?? 0) + 1, catalogue: structuredClone(s.draft), at: new Date().toISOString(), author: a.name }; s.revisions.push(r); s.activeRevisionId = r.id; s.draftBaseRevisionId = r.id; s.draftVersion = input.draftVersion + 1; audit(s, a.name, 'catalogue.published', `Revision ${r.number}`); return { revision: r.number }; }));
  }
  if (path === 'admin/rollback' && request.method === 'POST') {
    authorize(s, a, 'catalog.publish'); const { revisionId } = z.object({ revisionId: z.string().uuid() }).strict().parse(body);
    return Response.json(await store().transaction(s => { const prior = requireValue(s.revisions.find(r => r.id === revisionId)); const errors = validatePublication(prior.catalogue); if (errors.length) throw new AppError('PUBLICATION_INVALID', errors.join(' '), 422); const next = { ...structuredClone(prior), id: randomUUID(), number: (s.revisions.at(-1)?.number ?? 0) + 1, at: new Date().toISOString(), author: a.name }; s.revisions.push(next); s.activeRevisionId = next.id; s.draftBaseRevisionId = next.id; s.draft = structuredClone(next.catalogue); audit(s, a.name, 'catalogue.rollback', `Restored revision ${prior.number} as ${next.number}`); return { revision: next.number }; }));
  }
  if (path === 'admin/staff' && request.method === 'PUT') {
    if (!isDemo() && !s.staff.some(m => m.id === a.customerId && m.active && m.role === 'owner')) throw new AppError('FORBIDDEN', 'Only an active owner can manage team access.', 403);
    authorize(s, a, 'staff.manage'); const { staff } = z.object({ staff: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(120), email: z.email().transform(v => v.toLowerCase().trim()), role: z.enum(['owner', 'manager', 'staff']), active: z.boolean(), userId: z.string().uuid().nullable().default(null) }).strict()).max(50) }).strict().parse(body);
    const baseline = JSON.stringify(s.staff);
    for (const m of staff) {
      const previous = s.staff.find(member => member.id === m.id);
      // Authentication mappings are server-owned, including when an email is changed.
      m.userId = previous?.email.toLowerCase() === m.email ? previous.userId : null;
    }
    validateStaffAccess(staff, false);
    const currentStore = store();
    for (const m of staff) {
      if (!isDemo() && m.active && !m.userId) {
        m.userId = await currentStore.resolveAuthUser?.(m.email, m.name) ?? null;
        if (!m.userId) throw new AppError('STAFF_ACCOUNT_CREATION_FAILED', 'Could not create the team member’s login account. Team changes were not saved.', 503);
      }
    }
    validateStaffAccess(staff, !isDemo());
    return Response.json(await currentStore.transaction(s => {
      if (JSON.stringify(s.staff) !== baseline) throw new AppError('TEAM_CONFLICT', 'Team access changed while saving. Reload and review the latest team before saving again.', 409);
      authorize(s, a, 'staff.manage');
      if (!isDemo() && !s.staff.some(m => m.id === a.customerId && m.active && m.role === 'owner')) throw new AppError('FORBIDDEN', 'Only an active owner can manage team access.', 403);
      s.staff = staff; audit(s, a.name, 'staff.updated', 'Roles and access updated'); return { saved: true, staff };
    }));
  }
  if (path === 'admin/bookings' && request.method === 'POST') {
    authorize(s, a, 'catalog.write'); const input = z.object({ selection: quoteSchema, startAt: z.iso.datetime(), name: z.string().trim().min(1).max(120), email: z.email().transform(v => v.toLowerCase()), phone: z.string().max(25), source: z.enum(['phone', 'walk_in']), contactReviewed: z.literal(true) }).strict().parse(body);
    const key = requireValue(request.headers.get('idempotency-key'), 'VALIDATION_ERROR', 'A retry key is required.');
    return Response.json(await store().transaction(s => { const customerId = s.sessions.find(x => x.email === input.email && x.role === 'customer')?.customerId ?? `manual-${createHash('sha256').update(input.email).digest('hex').slice(0, 24)}`; const customer = { ...a, role: 'customer' as const, customerId, name: input.name, email: input.email }; const existing = s.bookings.find(b => b.customerId === customerId && b.idempotencyKey === key); if (existing) return existing; const q = resolveQuote(s, input.selection); s.quotes.push(q); const b = holdBooking(s, customer, { quoteId: q.id, startAt: input.startAt, phone: input.phone }, key); b.source = input.source; b.consent.source='staff_recorded'; confirmBooking(s, customer, b.id); audit(s, a.name, 'booking.manual_created', b.reference); return b; }), { status: 201 });
  }
  const bookingMatch = path.match(/^admin\/bookings\/([^/]+)$/);
  if (bookingMatch && request.method === 'PATCH') {
    authorize(s, a, 'bookings.write'); const input = z.object({ action: z.enum(['in_progress', 'completed', 'cancelled', 'no_show', 'collect', 'assign', 'note', 'reschedule']), reason: z.string().max(1000).optional(), staffId: z.string().nullable().optional(), startAt: z.iso.datetime().optional() }).strict().parse(body);
    if (['collect', 'assign', 'reschedule', 'note', 'cancelled', 'no_show'].includes(input.action) && a.role === 'staff') throw new AppError('FORBIDDEN', 'This action requires manager permission.', 403);
    if (input.action === 'collect') authorize(s, a, 'payments.collect');
    const updated = await store().transaction(s => { const b = ownedBooking(s, a, bookingMatch[1]);
      if (input.action === 'collect') return recordPayment(s, a, b.id, input.reason ?? '');
      if (input.action === 'reschedule') return rescheduleBooking(s, a, b.id, requireValue(input.startAt));
      if (input.action === 'assign') { if (input.staffId && !s.staff.some(m => m.id === input.staffId && m.active)) throw new AppError('NOT_FOUND', 'Choose an active staff member.'); b.staffId = input.staffId ?? null; audit(s, a.name, 'booking.assigned', b.reference); return b; }
      if (input.action === 'note') { b.notes = input.reason ?? ''; audit(s, a.name, 'booking.note_updated', b.reference); return b; }
      return changeBooking(s, a, b.id, input.action, input.reason ?? '');
    }); return Response.json(presentBooking(updated, a));
  }
  if (path === 'admin/reports/export' && request.method === 'GET') {
    authorize(s, a, 'reports.export'); const from = url.searchParams.get('from') ?? ''; const to = url.searchParams.get('to') ?? ''; const status = url.searchParams.get('status') ?? ''; const service = url.searchParams.get('service') ?? '';
    const rows = s.bookings.filter(b => (!from || localDay(new Date(b.startAt)) >= from) && (!to || localDay(new Date(b.startAt)) <= to) && (!status || b.status === status) && (!service || (b.quote.serviceIds ?? [b.quote.serviceId]).includes(service)));
    if (rows.length > 10000) throw new AppError('EXPORT_TOO_LARGE', 'Narrow the date range to fewer than 10,000 appointments.', 422);
    const bytes = await exportWorkbook(rows, { from, to, status, service, purpose: url.searchParams.get('purpose')?.slice(0, 200) ?? 'Studio operations' });
    await store().transaction(s => audit(s, a.name, 'report.exported', `${rows.length} bookings; ${from || 'all'} to ${to || 'all'}`));
    return new Response(bytes as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="balaji-studio-bookings.xlsx"' } });
  }
  return null;
}
