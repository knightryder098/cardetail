import { expect, it } from 'vitest';
import { SqliteStore } from '@/server/store';
import { createState } from '@/server/seed';
import { resolveQuote } from '@/server/domain';
import { holdBooking, confirmBooking, rescheduleBooking } from '@/server/bookings';
import type { Session } from '@/lib/types';
const now = new Date('2026-10-09T03:00:00Z');
const session: Session = { id: 'a', customerId: 'a', name: 'A', email: 'a@example.com', role: 'customer', expiresAt: '2026-11-01T00:00:00Z' };
it('rolls back both the aggregate and allocations on a failed transaction', async () => {
  const db = new SqliteStore(':memory:', createState());
  await expect(db.transaction(s => { s.draft.site.name = 'Broken'; throw new Error('rollback'); })).rejects.toThrow('rollback');
  expect((await db.read()).draft.site.name).toBe('Balaji Studio');
});
it('serializes two contenders for the final bay at the persistence boundary', async () => {
  const s = createState(); s.revisions[0].catalogue.schedule.bays = 1;
  const q = resolveQuote(s, { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', tierCode: 'normal', planCode: 'one_time' }, now); s.quotes.push(q);
  const db = new SqliteStore(':memory:', s);
  const results = await Promise.allSettled([db.transaction(s => holdBooking(s, session, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'a', now)), db.transaction(s => holdBooking(s, { ...session, customerId: 'b' }, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'b', now))]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect((await db.read()).bookings).toHaveLength(1);
});
it('has a database backstop even if application overlap checks are bypassed', async () => {
  const s = createState(); const q = resolveQuote(s, { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', tierCode: 'normal', planCode: 'one_time' }, now); s.quotes.push(q);
  const db = new SqliteStore(':memory:', s);
  await db.transaction(s => holdBooking(s, session, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'a', now));
  await expect(db.transaction(s => s.bookings.push({ ...s.bookings[0], id: 'different', customerId: 'b', idempotencyKey: 'different' }))).rejects.toThrow('SLOT_UNAVAILABLE');
  expect((await db.read()).bookings).toHaveLength(1);
});
it('reschedules into capacity released by a timed-out hold in the same transaction', async () => {
  const s=createState();s.revisions[0].catalogue.schedule.bays=1;const q=resolveQuote(s,{modelId:'veh-swift',serviceId:'svc-exterior-detail',tierCode:'normal',planCode:'one_time'},now);s.quotes.push(q);
  const original=holdBooking(s,session,{quoteId:q.id,startAt:'2026-10-10T03:30:00Z'},'original',now);confirmBooking(s,session,original.id,now);
  const timedOut=holdBooking(s,{...session,customerId:'other'},{quoteId:q.id,startAt:'2026-10-10T06:30:00Z'},'temporary',now);
  const db=new SqliteStore(':memory:',s);const changed=await db.transaction(s=>rescheduleBooking(s,session,original.id,timedOut.startAt,new Date(now.getTime()+11*60000)));
  expect(changed.startAt).toBe(timedOut.startAt);expect((await db.read()).bookings.find(b=>b.id===timedOut.id)?.status).toBe('expired');
});
