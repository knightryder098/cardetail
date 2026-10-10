import type { Booking, BookingStatus, Session, State } from '@/lib/types';
import { randomUUID } from 'node:crypto';
import { availableSlots, freeBays, publishedCatalogue } from './domain';
import { localDay } from '@/lib/format';
import { AppError, requireValue } from './errors';
export function audit(s: State, actor: string, action: string, detail: string, now = new Date()) { s.audit.push({ id: randomUUID(), at: now.toISOString(), actor, action, detail }); }
export function ownedBooking(s: State, actor: Session, id: string): Booking {
  return requireValue(s.bookings.find(b => b.id === id && (b.customerId === actor.customerId || actor.role === 'owner' || actor.role === 'manager' || (actor.role === 'staff' && b.staffId === actor.customerId))), 'NOT_FOUND', 'This booking is unavailable.');
}
export function packageBalance(s: State, packageId: string): number { return s.ledger.filter(e => e.packageId === packageId).reduce((sum, e) => sum + e.units, 0); }
function ledger(s: State, packageId: string, bookingId: string | null, kind: 'grant' | 'redeem' | 'restore', units: number, now: Date) {
  const reference = `${packageId}:${bookingId ?? 'purchase'}:${kind}`;
  if (!s.ledger.some(e => e.reference === reference)) s.ledger.push({ id: randomUUID(), packageId, bookingId, kind, units, at: now.toISOString(), reference });
}
function notify(s: State, b: Booking, kind: string, now: Date) { s.outbox.push({ id: randomUUID(), bookingId: b.id, kind, status: process.env.APP_MODE === 'live' ? 'pending' : 'demo_recorded', at: now.toISOString(), attempts: 0 }); }
function restore(s: State, b: Booking, now: Date, reservationOnly = false) { if (b.packageId && (reservationOnly || b.quote.snapshot.plan.restoreOnCancel) && s.ledger.some(e => e.bookingId === b.id && e.kind === 'redeem')) ledger(s, b.packageId, b.id, 'restore', 1, now); }
export function expireHolds(s: State, now = new Date()) {
  for (const b of s.bookings) if (b.status === 'held' && new Date(b.holdExpiresAt) <= now) { b.status = 'expired'; restore(s, b, now, true); b.events.push({ at: now.toISOString(), action: 'expired', actor: 'System', reason: 'Reservation timed out' }); }
}
export function holdBooking(s: State, actor: Session, input: { quoteId: string; startAt: string; phone?: string; packageId?: string; termsAccepted?:true;marketingConsent?:boolean }, key: string, now = new Date()): Booking {
  if (!key || key.length > 120) throw new AppError('VALIDATION_ERROR', 'A valid retry key is required.');
  const normalizedStart = new Date(input.startAt).toISOString();
  const existing = s.bookings.find(b => b.customerId === actor.customerId && b.idempotencyKey === key);
  if (existing) {
    if (existing.quote.id !== input.quoteId || existing.startAt !== normalizedStart || (input.packageId && existing.packageId !== input.packageId)) throw new AppError('IDEMPOTENCY_CONFLICT', 'This retry key belongs to another appointment.', 409);
    return existing;
  }
  expireHolds(s, now);
  let q = requireValue(s.quotes.find(q => q.id === input.quoteId));
  if (new Date(q.expiresAt) <= now || (!input.packageId && q.revisionId !== s.activeRevisionId)) throw new AppError('QUOTE_EXPIRED', 'Your quote expired. Refresh it to continue.', 409);
  if(q.packageId&&q.packageId!==input.packageId)throw new AppError('NOT_ELIGIBLE','This quote is bound to a prepaid pack.',422);
  if (input.packageId) {
    const p = requireValue(s.packages.find(p => p.id === input.packageId && p.customerId === actor.customerId));
    if (p.status !== 'active') throw new AppError('PACKAGE_UNPAID', 'This pack is waiting for payment.', 422);
    if(new Date(normalizedStart)<new Date(p.startsAt))throw new AppError('PACKAGE_NOT_STARTED','This pack has not started for the chosen appointment.',422);
    if (p.expiresAt && new Date(normalizedStart) >= new Date(p.expiresAt)) throw new AppError('PACKAGE_EXPIRED', 'This pack is expired for the chosen appointment.', 422);
    if (p.serviceId !== q.serviceId || p.tierCode !== q.tierCode || p.modelId !== q.modelId || p.quote.planCode !== q.planCode) throw new AppError('NOT_ELIGIBLE', 'This treatment is outside your pack.', 422);
    if(JSON.stringify(p.quote.serviceIds??[p.quote.serviceId])!==JSON.stringify(q.serviceIds??[q.serviceId]))throw new AppError('NOT_ELIGIBLE','This combination of services is outside your pack.',422);
    if (packageBalance(s, p.id) < 1) throw new AppError('PACKAGE_EMPTY', 'There are no visits left in this pack.', 409);
    q={...structuredClone(p.quote),id:q.id,revisionId:q.revisionId,at:q.at,expiresAt:q.expiresAt,subtotalPaise:0,taxPaise:0,totalPaise:0};
  }
  const slot = availableSlots(s, q, localDay(new Date(normalizedStart)), now).find(slot => slot.startAt === normalizedStart);
  if (!slot) throw new AppError('SLOT_UNAVAILABLE', 'That time is unavailable. Choose another available time.', 409);
  const end = new Date(normalizedStart).getTime() + q.durationMinutes * 60000;
  const blockedEnd = end + publishedCatalogue(s).schedule.bufferMinutes * 60000;
  const bay = freeBays(s, new Date(normalizedStart).getTime(), blockedEnd, now)[0];
  if (!bay) throw new AppError('SLOT_UNAVAILABLE', 'That time was just booked. Choose another available time.', 409);
  const id = randomUUID();
  const b: Booking = { consent:{acceptedAt:now.toISOString(),revisionId:q.revisionId,marketing:input.marketingConsent??false,source:'web'}, id, reference: `CD-${now.getFullYear()}-${id.slice(0, 8).toUpperCase()}`, customerId: actor.customerId, customerName: actor.name, email: actor.email, phone: input.phone ?? '', quote: input.packageId ? { ...structuredClone(q), subtotalPaise: 0, taxPaise: 0, totalPaise: 0 } : structuredClone(q), startAt: normalizedStart, endAt: new Date(end).toISOString(), blockedUntil: new Date(blockedEnd).toISOString(), bay, staffId: null, status: 'held', paymentStatus: input.packageId ? 'captured' : 'unpaid', paymentMode: input.packageId ? 'package_entitlement' : 'pay_at_studio', source: 'web', createdAt: now.toISOString(), holdExpiresAt: new Date(now.getTime() + 10 * 60000).toISOString(), packageId: input.packageId ?? null, idempotencyKey: key, notes: '', events: [{ at: now.toISOString(), action: 'held', actor: actor.name, reason: 'Appointment reserved for 10 minutes' }] };
  s.bookings.push(b);
  if (input.packageId) ledger(s, input.packageId, b.id, 'redeem', -1, now);
  audit(s, actor.name, 'booking.held', b.reference, now);
  return b;
}
export function confirmBooking(s: State, actor: Session, id: string, now = new Date()): Booking {
  expireHolds(s, now); const b = ownedBooking(s, actor, id);
  if (b.status === 'confirmed') return b;
  if (b.status !== 'held') throw new AppError('HOLD_EXPIRED', 'Your reservation expired. Choose a fresh appointment.', 409);
  b.status = 'confirmed';
  if (b.quote.planCode !== 'one_time' && !b.packageId) { const p = { id: randomUUID(), customerId: b.customerId, serviceId: b.quote.serviceId, tierCode: b.quote.tierCode, modelId: b.quote.modelId, quote: structuredClone(b.quote), status: 'pending_manual_payment' as const, startsAt: b.startAt, expiresAt: null }; s.packages.push(p); b.packageId = p.id; }
  b.events.push({ at: now.toISOString(), action: 'confirmed', actor: actor.name, reason: b.paymentMode === 'package_entitlement' ? 'One prepaid visit reserved' : 'Pay at studio — payment due on arrival' });
  audit(s, actor.name, 'booking.confirmed', b.reference, now); notify(s, b, 'booking.confirmed', now); return b;
}
const transitions: Record<BookingStatus, BookingStatus[]> = { held: ['cancelled'], confirmed: ['in_progress', 'cancelled', 'no_show'], in_progress: ['completed'], completed: [], cancelled: [], no_show: [], expired: [] };
export function changeBooking(s: State, actor: Session, id: string, action: string, reason = '', now = new Date()): Booking {
  expireHolds(s, now);
  const b = ownedBooking(s, actor, id);
  if (b.status === action) return b;
  if (actor.role === 'customer' && action !== 'cancelled') throw new AppError('FORBIDDEN', 'This action requires staff permission.', 403);
  if (!transitions[b.status].includes(action as BookingStatus)) throw new AppError('INVALID_TRANSITION', 'This booking transition is not allowed.', 409);
  if (action === 'cancelled' && actor.role === 'customer' && new Date(b.startAt).getTime() - now.getTime() < b.quote.snapshot.policyCutoffHours * 3600000) throw new AppError('POLICY_CUTOFF', 'The cancellation window has closed. Contact the studio.', 422);
  if (action === 'cancelled' && actor.role !== 'customer' && !reason.trim()) throw new AppError('REASON_REQUIRED', 'Enter a reason for this cancellation.');
  const reservationOnly = b.status === 'held'; b.status = action as BookingStatus;
  if (action === 'cancelled') restore(s, b, now, reservationOnly);
  b.events.push({ at: now.toISOString(), action, actor: actor.name, reason }); audit(s, actor.name, `booking.${action}`, `${b.reference}: ${reason}`, now); notify(s, b, `booking.${action}`, now); return b;
}
export function recordPayment(s: State, actor: Session, id: string, reason: string, now = new Date()): Booking {
  if (!['owner', 'manager'].includes(actor.role)) throw new AppError('FORBIDDEN', 'Collection requires owner or manager permission.', 403);
  const b = ownedBooking(s, actor, id);
  if (b.paymentStatus === 'captured') return b;
  if (!['confirmed', 'in_progress', 'completed'].includes(b.status)) throw new AppError('INVALID_TRANSITION', 'Payment can be collected only for an accepted appointment.', 409);
  if (!reason.trim()) throw new AppError('REASON_REQUIRED', 'Record the payment method and collection note.');
  b.paymentStatus = 'captured';
  if (b.packageId) { const p = requireValue(s.packages.find(p => p.id === b.packageId)); p.status = 'active'; p.startsAt = b.startAt; p.expiresAt = b.quote.validityDays ? new Date(new Date(b.startAt).getTime() + b.quote.validityDays * 86400000).toISOString() : null; ledger(s, p.id, null, 'grant', b.quote.visits, now); ledger(s, p.id, b.id, 'redeem', -1, now); }
  b.events.push({ at: now.toISOString(), action: 'payment_collected', actor: actor.name, reason }); audit(s, actor.name, 'payment.collected', `${b.reference}: ${reason}`, now); return b;
}
export function rescheduleBooking(s: State, actor: Session, id: string, startAt: string, now = new Date()): Booking {
  expireHolds(s, now);
  const b = ownedBooking(s, actor, id);
  if (b.status !== 'confirmed') throw new AppError('INVALID_TRANSITION', 'Only confirmed appointments can be rescheduled.', 409);
  if (actor.role === 'customer' && new Date(b.startAt).getTime() - now.getTime() < b.quote.snapshot.policyCutoffHours * 3600000) throw new AppError('POLICY_CUTOFF', 'The rescheduling window has closed. Contact the studio.', 422);
  const normalized = new Date(startAt).toISOString();
  if (b.packageId) { const p = s.packages.find(p => p.id === b.packageId); if(p?.status==='active'&&b.paymentMode==='package_entitlement'&&new Date(normalized)<new Date(p.startsAt))throw new AppError('PACKAGE_NOT_STARTED','This pack has not started for that appointment.',422); if (p?.expiresAt && new Date(normalized) >= new Date(p.expiresAt)) throw new AppError('PACKAGE_EXPIRED', 'The pack expires before that appointment.', 422); }
  if (!availableSlots(s, b.quote, localDay(new Date(normalized)), now, b.id).some(slot => slot.startAt === normalized)) throw new AppError('SLOT_UNAVAILABLE', 'That time is unavailable. Your original appointment is unchanged.', 409);
  const start = new Date(normalized).getTime(); const end = start + b.quote.durationMinutes * 60000; const blocked = end + publishedCatalogue(s).schedule.bufferMinutes * 60000;
  const bay = freeBays(s, start, blocked, now, b.id)[0]; if (!bay) throw new AppError('SLOT_UNAVAILABLE', 'That time is unavailable.', 409);
  b.startAt = normalized; b.endAt = new Date(end).toISOString(); b.blockedUntil = new Date(blocked).toISOString(); b.bay = bay;
  b.events.push({ at: now.toISOString(), action: 'rescheduled', actor: actor.name, reason: 'Appointment moved to another available time' }); audit(s, actor.name, 'booking.rescheduled', b.reference, now); notify(s, b, 'booking.rescheduled', now); return b;
}
