import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createState } from '@/server/seed';

const mocks = vi.hoisted(() => ({ read: vi.fn(), transaction: vi.fn(), context: vi.fn(), demo: vi.fn() }));
vi.mock('@/server/store', () => ({ store: () => ({ read: mocks.read, transaction: mocks.transaction }), isDemo: mocks.demo }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.context }));
import { publicData, invalidatePublicData } from '@/server/public-data';
import { handleAdmin } from '@/server/admin-api';

let saved: Response | undefined;
let jobs: Promise<unknown>[];
const edge = {
  match: vi.fn(async () => saved?.clone()),
  put: vi.fn(async (_key: Request, response: Response) => { saved = response.clone(); }),
  delete: vi.fn(async () => { saved = undefined; return true; }),
};
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T00:00:00Z'));
  saved = undefined; jobs = [];
  mocks.demo.mockReturnValue(false);
  mocks.read.mockResolvedValue(createState(true));
  mocks.context.mockReturnValue({ env: { APP_ORIGIN: 'https://www.example.com' }, ctx: { waitUntil: (job: Promise<unknown>) => jobs.push(job) } });
  vi.stubGlobal('caches', { open: vi.fn(async () => edge) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('serves repeated public reads from edge cache without retaining private state', async () => {
  const first = await publicData(); await Promise.all(jobs);
  expect(await publicData()).toEqual(first);
  expect(mocks.read).toHaveBeenCalledOnce();
  const payload = await saved!.json();
  expect(Object.keys(payload.data).sort()).toEqual(['catalogue', 'demo', 'revision']);
  expect(payload.data).not.toHaveProperty('sessions');
  expect(payload.data).not.toHaveProperty('draft');
  expect(saved!.headers.get('cache-control')).toBe('public, max-age=60');
});
it('refreshes expired content even if the cache returns an expired entry', async () => {
  await publicData(); await Promise.all(jobs);
  vi.advanceTimersByTime(60_001);
  await publicData();
  expect(mocks.read).toHaveBeenCalledTimes(2);
});
it('invalidates the public snapshot so publication or rollback can become visible', async () => {
  await publicData(); await Promise.all(jobs);
  await invalidatePublicData();
  await publicData();
  expect(edge.delete).toHaveBeenCalledOnce();
  expect(mocks.read).toHaveBeenCalledTimes(2);
});
it('clears cached content after successful publication and rollback, but not a draft save', async () => {
  const state = createState(true);
  mocks.read.mockResolvedValue(state);
  mocks.transaction.mockImplementation(async fn => fn(state));
  const actor = { id: 'owner-session', customerId: 'staff-owner', role: 'owner' as const, name: 'Owner', email: 'owner@example.com', mfa: true, expiresAt: '2030-01-01T00:00:00Z' };
  const original = await publicData(); await Promise.all(jobs);
  const originalRevision = state.activeRevisionId;
  const draft = structuredClone(state.draft); draft.site.tagline = 'Freshly published';
  const request = (route: string, method: string) => new Request(`https://www.example.com/api/v1/admin/${route}`, { method });
  await handleAdmin(request('catalogue', 'PUT'), 'admin/catalogue', actor, { catalogue: draft, baseRevisionId: originalRevision, draftVersion: state.draftVersion ?? 0 });
  expect(edge.delete).not.toHaveBeenCalled();
  expect((await publicData()).catalogue.site.tagline).toBe(original.catalogue.site.tagline);
  await handleAdmin(request('publish', 'POST'), 'admin/publish', actor, { baseRevisionId: originalRevision, draftVersion: state.draftVersion });
  expect(edge.delete).toHaveBeenCalledTimes(1);
  expect((await publicData()).catalogue.site.tagline).toBe('Freshly published'); await Promise.all(jobs);
  await handleAdmin(request('rollback', 'POST'), 'admin/rollback', actor, { revisionId: originalRevision });
  expect(edge.delete).toHaveBeenCalledTimes(2);
  expect((await publicData()).catalogue.site.tagline).toBe(original.catalogue.site.tagline);
});
it('keeps working with fresh reads when cache lookup fails', async () => {
  edge.match.mockRejectedValueOnce(new Error('cache unavailable'));
  expect((await publicData()).catalogue).toBeDefined();
  expect(mocks.read).toHaveBeenCalledOnce();
});
it('does not hide database failures or cache an error', async () => {
  mocks.read.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(publicData()).rejects.toThrow('database unavailable');
  expect(edge.put).not.toHaveBeenCalled();
});
it('does not cache local/demo state', async () => {
  mocks.demo.mockReturnValue(true);
  await publicData(); await publicData();
  expect(mocks.read).toHaveBeenCalledTimes(2);
  expect(edge.put).not.toHaveBeenCalled();
});
it('falls back outside the Cloudflare runtime', async () => {
  mocks.context.mockImplementationOnce(() => { throw new Error('not a worker'); });
  expect((await publicData()).catalogue).toBeDefined();
});
