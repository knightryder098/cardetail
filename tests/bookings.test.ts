import { describe, expect, it } from 'vitest';
import { createState } from '@/server/seed';
import { resolveQuote, resolvePackageQuote } from '@/server/domain';
import { holdBooking, confirmBooking, changeBooking, recordPayment, packageBalance, rescheduleBooking, expireHolds } from '@/server/bookings';
import type { Session, State } from '@/lib/types';
const now = new Date('2026-10-09T03:00:00Z');
const alice: Session = { id: 'session-a', customerId: 'alice', name: 'Alice', email: 'alice@example.com', role: 'customer', expiresAt: '2026-10-20T00:00:00Z' };
const bob: Session = { ...alice, id: 'session-b', customerId: 'bob', email: 'bob@example.com' };
const owner: Session = { ...alice, role: 'owner', customerId: 'owner', mfa: true };
function quote(s: State, plan: 'one_time' | 'monthly' = 'one_time') { const q = resolveQuote(s, { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', tierCode: 'normal', planCode: plan }, now); s.quotes.push(q); return q; }
function book(s: State, plan: 'one_time' | 'monthly' = 'one_time') { const q = quote(s, plan); const b = holdBooking(s, alice, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'first', now); return confirmBooking(s, alice, b.id, now); }
describe('Booking allocation and ownership', () => {
  it('allows only one booking in the final bay including cleanup time', () => {
    const s = createState(); s.revisions[0].catalogue.schedule.bays = 1; const q = quote(s);
    holdBooking(s, alice, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'a', now);
    expect(() => holdBooking(s, bob, { quoteId: q.id, startAt: '2026-10-10T04:30:00Z' }, 'b', now)).toThrow(/time/i);
  });
  it('returns the same hold on an identical retry', () => {
    const s = createState(); const q = quote(s); const args = { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' };
    const a = holdBooking(s, alice, args, 'same-key', now); const b = holdBooking(s, alice, args, 'same-key', now);
    expect(a.id).toBe(b.id); expect(s.bookings).toHaveLength(1);
  });
  it('rejects reused idempotency keys for a different appointment', () => {
    const s = createState(); const q = quote(s);
    holdBooking(s, alice, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'same', now);
    expect(() => holdBooking(s, alice, { quoteId: q.id, startAt: '2026-10-10T05:00:00Z' }, 'same', now)).toThrow(/retry/i);
  });
  it('denies access to a different customer’s booking', () => {
    const s = createState(); const b = book(s);
    expect(() => changeBooking(s, bob, b.id, 'cancelled', '', now)).toThrow(/unavailable/i);
  });
  it('rejects completing a job before it has started', () => {
    const s = createState(); const b = book(s);
    expect(() => changeBooking(s, owner, b.id, 'completed', '', now)).toThrow(/transition/i);
  });
  it('releases expired holds before admitting another customer', () => {
    const s = createState(); s.revisions[0].catalogue.schedule.bays = 1; const q = quote(s);
    const b = holdBooking(s, alice, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'old', now);
    const later = new Date('2026-10-09T03:11:00Z'); const q2 = resolveQuote(s, q, later); s.quotes.push(q2);
    const replacement = holdBooking(s, bob, { quoteId: q2.id, startAt: '2026-10-10T03:30:00Z' }, 'new', later);
    expect(b.status).toBe('expired'); expect(replacement.status).toBe('held');
  });
  it('keeps the old appointment when a requested reschedule conflicts', () => {
    const s = createState(); s.revisions[0].catalogue.schedule.bays = 1; const a = book(s); const q = quote(s);
    const b = holdBooking(s, bob, { quoteId: q.id, startAt: '2026-10-10T06:30:00Z' }, 'other', now); confirmBooking(s, bob, b.id, now);
    expect(() => rescheduleBooking(s, alice, a.id, b.startAt, now)).toThrow(/time/i);
    expect(a.startAt).toBe('2026-10-10T03:30:00.000Z');
  });
});
describe('Prepaid package ledger', () => {
  it('keeps every treatment in a purchased bundle and consumes one visit for the bundle', () => {
    const s = createState();
    const q = resolveQuote(s, { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', serviceIds: ['svc-exterior-detail', 'svc-interior-detail'], tierCode: 'normal', planCode: 'monthly' }, now); s.quotes.push(q);
    const first = holdBooking(s, alice, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'bundle-first', now); confirmBooking(s, alice, first.id, now); recordPayment(s, owner, first.id, 'Cash', now);
    const purchased = resolvePackageQuote(s, first.packageId!, alice.customerId, now); s.quotes.push(purchased);
    const next = holdBooking(s, alice, { quoteId: purchased.id, startAt: '2026-10-12T03:30:00Z', packageId: first.packageId! }, 'bundle-next', now); confirmBooking(s, alice, next.id, now);
    expect(next.quote.serviceIds).toEqual(q.serviceIds); expect(next.quote.durationMinutes).toBe(q.durationMinutes); expect(next.quote.totalPaise).toBe(0); expect(packageBalance(s, first.packageId!)).toBe(2);
    changeBooking(s, alice, next.id, 'cancelled', 'Plans changed', now); expect(packageBalance(s, first.packageId!)).toBe(3);
  });
  it('rejects adding an extra treatment to a single-treatment prepaid pack', () => {
    const s = createState(); const first = book(s, 'monthly'); recordPayment(s, owner, first.id, 'Cash', now);
    const q = resolveQuote(s, { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', serviceIds: ['svc-exterior-detail', 'svc-interior-detail'], tierCode: 'normal', planCode: 'monthly' }, now); s.quotes.push(q);
    expect(() => holdBooking(s, alice, { quoteId: q.id, startAt: '2026-10-12T03:30:00Z', packageId: first.packageId! }, 'extra-treatment', now)).toThrow(/outside your pack/i);
    expect(packageBalance(s, first.packageId!)).toBe(3);
  });
  it('honors purchased scope and restoration terms after a plan is archived', () => {
    const s=createState();const first=book(s,'monthly');recordPayment(s,owner,first.id,'Cash',now);
    const plan=s.revisions[0].catalogue.plans.find(p=>p.code==='monthly')!;plan.enabled=false;plan.restoreOnCancel=false;
    const q=resolvePackageQuote(s,first.packageId!,alice.customerId,now);s.quotes.push(q);
    const held=holdBooking(s,alice,{quoteId:q.id,startAt:'2026-10-12T03:30:00Z',packageId:first.packageId!},'sold-pack',now);confirmBooking(s,alice,held.id,now);changeBooking(s,alice,held.id,'cancelled','Plans changed',now);
    expect(held.quote.snapshot.plan.restoreOnCancel).toBe(true);expect(packageBalance(s,first.packageId!)).toBe(3);expect(held.quote.totalPaise).toBe(0);
  });
  it('rejects prepaid visits before the purchased validity begins', () => {
    const s=createState();const first=book(s,'monthly');recordPayment(s,owner,first.id,'Cash',now);const q=quote(s,'monthly');
    expect(()=>holdBooking(s,alice,{quoteId:q.id,startAt:'2026-10-09T06:30:00Z',packageId:first.packageId!},'too-early',now)).toThrow(/not started/i);
  });
  it('returns a timed-out reservation even when confirmed cancellations are non-restorable', () => {
    const s = createState(); s.revisions[0].catalogue.plans.find(p => p.code === 'monthly')!.restoreOnCancel = false;
    const first = book(s, 'monthly'); recordPayment(s, owner, first.id, 'Cash', now);
    const q = quote(s, 'monthly'); const held = holdBooking(s, alice, { quoteId: q.id, startAt: '2026-10-12T03:30:00Z', packageId: first.packageId! }, 'timeout', now);
    expect(packageBalance(s, first.packageId!)).toBe(2);
    expireHolds(s, new Date(now.getTime() + 11 * 60000)); expireHolds(s, new Date(now.getTime() + 12 * 60000));
    expect(held.status).toBe('expired'); expect(packageBalance(s, first.packageId!)).toBe(3);
    expect(s.ledger.filter(e => e.bookingId === held.id && e.kind === 'restore')).toHaveLength(1);
  });
  it('does not issue usable visits for an unpaid pack', () => {
    const s = createState(); const b = book(s, 'monthly');
    expect(s.packages[0].status).toBe('pending_manual_payment'); expect(packageBalance(s, b.packageId!)).toBe(0);
  });
  it('grants visits once and consumes the first visit once on collection', () => {
    const s = createState(); const b = book(s, 'monthly');
    recordPayment(s, owner, b.id, 'Cash collected', now); recordPayment(s, owner, b.id, 'Retry', now);
    expect(packageBalance(s, b.packageId!)).toBe(3); expect(s.ledger).toHaveLength(2);
  });
  it('restores one visit on a timely cancellation without repeating it', () => {
    const s = createState(); const b = book(s, 'monthly'); recordPayment(s, owner, b.id, 'Cash', now);
    changeBooking(s, alice, b.id, 'cancelled', 'Plans changed', now); changeBooking(s, alice, b.id, 'cancelled', 'Retry', now);
    expect(packageBalance(s, b.packageId!)).toBe(4); expect(s.ledger.filter(e => e.kind === 'restore')).toHaveLength(1);
  });
  it('rejects package redemption after expiry', () => {
    const s = createState(); const b = book(s, 'monthly'); recordPayment(s, owner, b.id, 'Cash', now); const q = quote(s, 'monthly');
    expect(() => holdBooking(s, alice, { quoteId: q.id, startAt: '2026-11-20T03:30:00Z', packageId: b.packageId! }, 'later', now)).toThrow(/expired/i);
  });
});
