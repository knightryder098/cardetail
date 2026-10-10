import { describe, it, expect } from 'vitest';
import { createState } from '@/server/seed';
import { resolveQuote, availableSlots, validatePublication } from '@/server/domain';
const now = new Date('2026-10-09T03:00:00Z');
const input = { modelId: 'veh-x3', serviceId: 'svc-exterior-detail', tierCode: 'normal' as const, planCode: 'one_time' as const };
describe('Trusted pricing and publication', () => {
  it('refuses to enable booking without any offered services', () => {
    const c = createState().draft;
    c.services.forEach(s => { s.enabled = false; });
    expect(validatePublication(c).join(' ')).toMatch(/enable at least one service/i);
    c.bookingEnabled = false;
    expect(validatePublication(c)).toEqual([]);
  });
  it('refuses to enable booking without an offered plan', () => {
    const c = createState().draft;
    c.plans.forEach(p => { p.enabled = false; });
    expect(validatePublication(c).join(' ')).toMatch(/enable at least one care plan/i);
  });
  it('refuses to enable booking when every weekday is closed', () => {
    const c = createState().draft;
    c.schedule.closedWeekdays = [0, 1, 2, 3, 4, 5, 6];
    expect(validatePublication(c).join(' ')).toMatch(/open at least one weekday/i);
  });
  it('adds prices and duration for multiple services and preserves each treatment snapshot', () => {
    const s=createState();const q=resolveQuote(s,{...input,serviceIds:['svc-exterior-detail','svc-interior-detail']},now);
    expect(q.totalPaise).toBe(592000);expect(q.durationMinutes).toBe(180);
    expect(q.items?.map(item=>item.snapshot.service.name)).toEqual(['Exterior Detail','Interior Detail']);
    s.revisions[0].catalogue.services[2].name='Changed';expect(q.items?.[1].snapshot.service.name).toBe('Interior Detail');
    expect(availableSlots(s,q,'2026-10-10',now).at(-1)?.label).toBe('3:30 pm');
  });
  it('rejects duplicate services and an invalid primary selection',()=>{
    expect(()=>resolveQuote(createState(),{...input,serviceIds:[input.serviceId,input.serviceId]},now)).toThrow(/unique/i);
    expect(()=>resolveQuote(createState(),{...input,serviceIds:['svc-interior-detail']},now)).toThrow(/selection/i);
  });
  it('rejects a selected service with no approved price instead of silently omitting it',()=>{
    const s=createState();s.revisions[0].catalogue.services[2].tiers[0].prices.luxury.one_time=null;
    expect(()=>resolveQuote(s,{...input,serviceIds:[input.serviceId,'svc-interior-detail']},now)).toThrow(/price/i);
  });
  it('rejects a combined visit that cannot fit in a studio day',()=>{
    expect(()=>resolveQuote(createState(),{...input,serviceIds:[input.serviceId,'svc-interior-detail','svc-ceramic-coating','svc-paint-correction','svc-paint-protection']},now)).toThrow(/working day/i);
  });
  it('prices a luxury SUV from the reviewed model instead of body shape', () => {
    const q = resolveQuote(createState(), input, now);
    expect(q.totalPaise).toBe(192000);
    expect(q.snapshot.vehicle.body).toBe('suv');
    expect(q.snapshot.vehicle.pricingClass).toBe('luxury');
  });
  it('refuses unknown vehicles rather than inventing a price', () => {
    expect(() => resolveQuote(createState(), { ...input, modelId: 'unknown' }, now)).toThrow(/model/i);
  });
  it('rejects unpriced offerings', () => {
    const s = createState(); s.revisions[0].catalogue.services[0].tiers[0].prices.luxury.one_time = null;
    expect(() => resolveQuote(s, input, now)).toThrow(/price/i);
  });
  it('preserves the original service snapshot after later edits', () => {
    const s = createState(); const q = resolveQuote(s, input, now);
    s.revisions[0].catalogue.services[0].name = 'Changed';
    expect(q.snapshot.service.name).toBe('Exterior Detail');
  });
  it('blocks publication of missing prices and unknown products', () => {
    const s = createState(); s.draft.services[0].tiers[0].prices.standard.one_time = null;
    s.draft.services[0].tiers[0].productIds.push('unknown');
    expect(validatePublication(s.draft).join(' ')).toMatch(/price/i);
    expect(validatePublication(s.draft).join(' ')).toMatch(/material/i);
  });
  it('uses integer inclusive tax rounding without changing the total', () => {
    const s = createState(); s.revisions[0].catalogue.taxBps = 1800;
    const q = resolveQuote(s, input, now);
    expect(q.totalPaise).toBe(192000); expect(q.taxPaise).toBe(29288); expect(q.subtotalPaise).toBe(162712);
  });
});
describe('Advisory scheduling', () => {
  it('offers working-day slots that fit treatment plus cleanup', () => {
    const s = createState(); const q = resolveQuote(s, input, now);
    const slots = availableSlots(s, q, '2026-10-10', now);
    expect(slots[0].startAt).toBe('2026-10-10T03:30:00.000Z');
    expect(slots.at(-1)?.label).toBe('5:30 pm');
  });
  it('returns no slots on Sundays or closures', () => {
    const s = createState(); const q = resolveQuote(s, input, now);
    expect(availableSlots(s, q, '2026-10-11', now)).toEqual([]);
    s.revisions[0].catalogue.schedule.closures = ['2026-10-10'];
    expect(availableSlots(s, q, '2026-10-10', now)).toEqual([]);
  });
  it('does not expose slots beyond the booking horizon', () => {
    const s = createState(); const q = resolveQuote(s, input, now);
    expect(availableSlots(s, q, '2027-02-01', now)).toEqual([]);
  });
});
