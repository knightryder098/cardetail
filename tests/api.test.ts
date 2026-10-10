import { beforeAll, expect, it } from 'vitest';
import { handleApi } from '@/server/api';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { store } from '@/server/store';
import { resolveQuote, availableSlots } from '@/server/domain';
import { holdBooking } from '@/server/bookings';
import { addDays, localDay } from '@/lib/format';
beforeAll(() => { process.env.APP_MODE = 'demo'; process.env.DEMO_DATABASE_PATH = path.join(tmpdir(), `balaji-api-${randomUUID()}.sqlite`); });
const call = (path: string, method = 'GET', body?: unknown, cookie?: string, extra: Record<string, string> = {}) => handleApi(new Request(`http://localhost:3000/api/v1/${path}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', ...(cookie ? { Cookie: cookie } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) }));
it('rejects anonymous dashboard access', async () => { expect((await call('admin/data')).status).toBe(401); });
it('reuses a signed-in session instead of creating another verification challenge', async () => {
  const login = await call('auth/demo-owner', 'POST', {});
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const before = (await store().read()).challenges.length;
  const response = await call('auth/request-verification', 'POST', { name: 'Studio owner', email: 'owner@example.com' }, cookie);
  expect(await response.json()).toMatchObject({ signedIn: true, name: 'Studio owner' });
  expect((await store().read()).challenges).toHaveLength(before);
});
it('rejects a mutation from another origin', async () => { expect((await call('auth/demo-owner', 'POST', {}, undefined, { Origin: 'https://evil.example' })).status).toBe(403); });
it('rejects client price and class manipulation with strict input validation', async () => { const r = await call('quotes', 'POST', { modelId: 'veh-swift', serviceId: 'svc-exterior-detail', tierCode: 'normal', planCode: 'one_time', totalPaise: 1, pricingClass: 'standard' }); expect(r.status).toBe(400); });
it('requires contact verification before reserving capacity', async () => { const r = await call('bookings/hold', 'POST', { quoteId: randomUUID(), startAt: '2026-10-10T03:30:00Z' }, undefined, { 'Idempotency-Key': 'a' }); expect(r.status).toBe(401); });
it('keeps draft content private until an authorized publication', async () => {
  const login = await call('auth/demo-owner', 'POST', {}); const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const d = await (await call('admin/data', 'GET', undefined, cookie)).json(); const draft = d.draft; draft.site.tagline = 'A private draft';
  const saved = await call('admin/catalogue', 'PUT', { catalogue: draft, baseRevisionId: d.activeRevisionId, draftVersion:d.draftVersion }, cookie); expect(saved.status).toBe(200);
  const {draftVersion} = await saved.json();
  const p = await (await call('public/site')).json(); expect(p.catalogue.site.tagline).not.toBe('A private draft');
  expect((await call('admin/publish', 'POST', { baseRevisionId: d.activeRevisionId, draftVersion }, cookie)).status).toBe(200);
  const published = await (await call('public/site')).json(); expect(published.catalogue.site.tagline).toBe('A private draft');
});
it('rejects stale editor saves and stale draft publication', async () => {
  const login=await call('auth/demo-owner','POST',{});const cookie=login.headers.get('set-cookie')!.split(';')[0];
  const d=await (await call('admin/data','GET',undefined,cookie)).json();const input={catalogue:d.draft,baseRevisionId:d.activeRevisionId,draftVersion:d.draftVersion};
  expect((await call('admin/catalogue','PUT',input,cookie)).status).toBe(200);
  expect((await call('admin/catalogue','PUT',input,cookie)).status).toBe(409);
  expect((await call('admin/publish','POST',{baseRevisionId:d.activeRevisionId,draftVersion:d.draftVersion},cookie)).status).toBe(409);
});
it('does not let an owner without MFA confirm another customer through the public endpoint',async()=>{
  const actor={id:randomUUID(),customerId:'other-customer',name:'Other customer',email:'other@example.com',role:'customer' as const,expiresAt:'2030-01-01T00:00:00Z'};
  const b=await store().transaction(s=>{const q=resolveQuote(s,{modelId:'veh-swift',serviceId:'svc-exterior-detail',tierCode:'normal',planCode:'one_time'});s.quotes.push(q);const slot=Array.from({length:7},(_,i)=>availableSlots(s,q,addDays(localDay(),i+1))).flat()[0];return holdBooking(s,actor,{quoteId:q.id,startAt:slot.startAt},randomUUID());});
  const unverifiedOwner={...actor,id:randomUUID(),customerId:'staff-owner',role:'owner' as const,mfa:false};await store().transaction(s=>s.sessions.push(unverifiedOwner));
  const r=await call(`bookings/${b.id}/confirm-manual`,'POST',{},`cd-session=${unverifiedOwner.id}`);expect(r.status).toBe(404);expect((await r.json()).email).toBeUndefined();
});
