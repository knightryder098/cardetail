import { beforeEach, expect, it, vi } from 'vitest';
import { createState } from '@/server/seed';
import type { State } from '@/lib/types';
const mocks = vi.hoisted(() => ({ read: vi.fn(), transaction: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/server/store', () => ({ store: () => ({ read: mocks.read, transaction: mocks.transaction }), isDemo: () => true }));
vi.mock('@/server/public-data', () => ({ invalidatePublicData: mocks.invalidate }));
import { handleAdmin } from '@/server/admin-api';
let state: State;
const owner = { id: 'owner-session', customerId: 'staff-owner', name: 'Owner', email: 'owner@example.com', role: 'owner' as const, mfa: true, expiresAt: '2030-01-01T00:00:00Z' };
beforeEach(() => {
  vi.clearAllMocks(); state = createState(true);
  mocks.read.mockImplementation(async () => structuredClone(state));
  mocks.transaction.mockImplementation(async fn => {
    const next = structuredClone(state); const result = fn(next); state = next; return result;
  });
});
const publish = (section: string) => handleAdmin(new Request('https://example.com/api/v1/admin/publish', { method: 'POST' }), 'admin/publish', owner, { section, baseRevisionId: state.activeRevisionId, draftVersion: state.draftVersion });

it('publishes only the current page while preserving other saved drafts', async () => {
  const live = structuredClone(state.revisions.at(-1)!.catalogue);
  state.draft.services[0].tiers[0].prices.standard.monthly = null;
  state.draft.site.tagline = 'Only this page goes live';
  await publish('site');
  expect(state.revisions.at(-1)!.catalogue.site.tagline).toBe('Only this page goes live');
  expect(state.revisions.at(-1)!.catalogue.services).toEqual(live.services);
  expect(state.draft.services[0].tiers[0].prices.standard.monthly).toBeNull();
  expect(mocks.invalidate).toHaveBeenCalledOnce();
});
it('saves packages without validating unrelated draft fields', async () => {
  const edited = structuredClone(state.draft); edited.site.name = ''; edited.plans[1].name = 'Independent plan';
  await handleAdmin(new Request('https://example.com/api/v1/admin/catalogue', { method: 'PUT' }), 'admin/catalogue', owner, { section: 'packages', catalogue: edited, baseRevisionId: state.activeRevisionId, draftVersion: state.draftVersion });
  expect(state.draft.plans[1].name).toBe('Independent plan');
  expect(state.draft.site.name).not.toBe('');
});
it('requires published prices when enabling a plan, and provides every affected combination', async () => {
  const live = state.revisions.at(-1)!.catalogue;
  live.plans.find(p => p.code === 'monthly')!.enabled = false;
  for (const service of live.services) for (const tier of service.tiers) for (const cls of ['standard', 'premium', 'luxury'] as const) tier.prices[cls].monthly = null;
  state.draft.plans.find(p => p.code === 'monthly')!.enabled = true;
  await expect(publish('packages')).rejects.toMatchObject({ code: 'PUBLICATION_INVALID', details: { issues: expect.arrayContaining([expect.objectContaining({ section: 'prices', planCode: 'monthly', pricingClass: 'standard' })]) } });
  expect(mocks.invalidate).not.toHaveBeenCalled();
  // Prices are ready in draft, but they must be published before enabling the offer.
  await publish('prices');
  await publish('packages');
  expect(state.revisions.at(-1)!.catalogue.plans.find(p => p.code === 'monthly')!.enabled).toBe(true);
});
