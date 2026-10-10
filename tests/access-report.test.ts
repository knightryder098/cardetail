import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { authorize } from '@/server/authorization';
import { presentBooking, validateStaffAccess } from '@/server/admin-api';
import { linkManualBookings } from '@/server/auth';
import { exportWorkbook } from '@/server/reports';
import { createState } from '@/server/seed';
import { resolveQuote } from '@/server/domain';
import { holdBooking, confirmBooking } from '@/server/bookings';
import type { Session } from '@/lib/types';
const owner: Session = { id: 'o', customerId: 'owner', name: '=HYPERLINK("evil")', email: 'a@example.com', role: 'owner', mfa: true, expiresAt: '2030-01-01T00:00:00Z' };
it('denies anonymous administration', () => { expect(() => authorize(createState(), null, 'catalog.write')).toThrow(/sign in/i); });
it('denies staff catalogue changes and financial exports', () => {
  const staff = { ...owner, role: 'staff' as const };
  expect(() => authorize(createState(), staff, 'catalog.write')).toThrow(/permission/i);
  expect(() => authorize(createState(), staff, 'reports.export')).toThrow(/permission/i);
});
it('requires MFA for live owner publication', () => { expect(() => authorize(createState(), { ...owner, mfa: false }, 'catalog.publish')).toThrow(/verification/i); });
it('lets managers edit drafts while keeping publication owner-only', () => {
  const manager = { ...owner, role: 'manager' as const };
  expect(authorize(createState(), manager, 'catalog.write').role).toBe('manager');
  expect(() => authorize(createState(), manager, 'catalog.publish')).toThrow(/permission/i);
});
it('requires a mapped live owner and rejects ambiguous authentication mappings',()=>{
  const staff=createState(false).staff;expect(()=>validateStaffAccess(staff,true)).toThrow(/mapped owner/i);
  staff[0].userId='11111111-1111-4111-8111-111111111111';expect(()=>validateStaffAccess(staff,true)).not.toThrow();
  staff.push({...staff[0],id:'another'});expect(()=>validateStaffAccess(staff,true)).toThrow(/unique/i);
});
it('uses the same restricted booking projection after staff updates', () => {
  const s = createState(); const now = new Date('2026-10-09T03:00:00Z'); const q = resolveQuote(s, { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', tierCode: 'normal', planCode: 'one_time' }, now); s.quotes.push(q);
  const b = holdBooking(s, owner, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z', phone: '9000000000' }, 'staff', now);
  const safe = presentBooking(b, { ...owner, role: 'staff' });
  expect(safe.email).not.toBe(b.email); expect(safe.phone).not.toBe(b.phone); expect(safe.quote.totalPaise).toBe(0); expect(safe.quote.snapshot.tier.prices.standard.one_time).toBeNull();
});
it('links manual appointments and purchased packs only to a verified matching email', () => {
  const s = createState(); const now = new Date('2026-10-09T03:00:00Z'); const q = resolveQuote(s, { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', tierCode: 'normal', planCode: 'monthly' }, now); s.quotes.push(q);
  const customer = { ...owner, role: 'customer' as const, customerId: `manual-${createHash('sha256').update(owner.email).digest('hex').slice(0, 24)}` };
  const b = holdBooking(s, customer, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'manual', now); confirmBooking(s, customer, b.id, now);
  linkManualBookings(s, { ...customer, customerId: 'verified-user', email: 'different@example.com' }); expect(b.customerId).toBe(customer.customerId);
  linkManualBookings(s, { ...customer, customerId: 'verified-user' }); expect(b.customerId).toBe('verified-user'); expect(s.packages[0].customerId).toBe('verified-user');
});
it('redacts prices from every item in a multiple-service staff booking', () => {
  const s = createState(); const now = new Date('2026-10-09T03:00:00Z');
  const q = resolveQuote(s, { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', serviceIds: ['svc-exterior-detail', 'svc-interior-detail'], tierCode: 'normal', planCode: 'one_time' }, now); s.quotes.push(q);
  const b = holdBooking(s, owner, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'bundle-staff', now);
  const safe = presentBooking(b, { ...owner, role: 'staff' });
  expect(safe.quote.items).toHaveLength(2);
  for (const item of safe.quote.items!) {
    expect(item.totalPaise).toBe(0); expect(item.snapshot.service.tiers).toEqual([]);
    expect(item.snapshot.tier.prices.standard.one_time).toBeNull();
  }
  expect(b.quote.items![0].totalPaise).toBeGreaterThan(0);
});
it('writes malicious-looking input as literal Excel text and includes filter metadata', async () => {
  const s = createState(); const now = new Date('2026-10-09T03:00:00Z'); const q = resolveQuote(s, { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', tierCode: 'normal', planCode: 'one_time' }, now); s.quotes.push(q);
  const b = holdBooking(s, owner, { quoteId: q.id, startAt: '2026-10-10T03:30:00Z' }, 'key', now); confirmBooking(s, owner, b.id, now);
  const bytes = await exportWorkbook([b], { from: '2026-10-10', to: '2026-10-10' }); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(bytes) as never);
  expect(wb.getWorksheet('Bookings')?.getCell('D2').value).toBe('=HYPERLINK("evil")');
  expect(wb.getWorksheet('Bookings')?.getCell('D2').type).toBe(ExcelJS.ValueType.String);
  expect(wb.getWorksheet('Filters')?.getCell('B2').value).toBe('2026-10-10');
});
