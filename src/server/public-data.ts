import type { PublicData, State } from '@/lib/types';
import { cache } from 'react';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createCatalogue } from './seed';
import { isDemo, store } from './store';
export function projectPublic(s: State): PublicData {
  const revision = s.revisions.find(r => r.id === s.activeRevisionId);
  if (!revision) { const empty = createCatalogue(false); empty.services = []; empty.products = []; empty.vehicles = []; empty.plans = []; return { catalogue: empty, revision: 0, demo: isDemo() }; }
  const c = structuredClone(revision.catalogue); c.services = c.services.filter(s => s.enabled).map(s => ({ ...s, tiers: s.tiers.filter(t => t.enabled) })); c.vehicles = c.vehicles.filter(v => v.reviewed); c.plans = c.plans.filter(p => p.enabled);
  return { catalogue: c, revision: revision.number, demo: isDemo() };
}
const PUBLIC_TTL_SECONDS = 60;

async function edgeCache() {
  if (isDemo() || typeof caches === 'undefined') return null;
  try {
    const { env, ctx } = getCloudflareContext();
    // Only the public projection goes into this cache, never the private state row.
    const key = new Request(new URL('/_internal/public-catalogue-v1', env.APP_ORIGIN));
    return { cache: await caches.open('balaji-public-catalogue-v1'), key, ctx };
  } catch { return null; }
}

async function loadPublicData(): Promise<PublicData> {
  const edge = await edgeCache();
  if (edge) {
    try {
      const hit = await edge.cache.match(edge.key);
      if (hit) {
        const snapshot: { expiresAt: number; data: PublicData } = await hit.json();
        if (snapshot.expiresAt > Date.now() && snapshot.data.demo === false) return snapshot.data;
      }
    } catch { console.warn('Public catalogue cache lookup failed; reading published data.'); }
  }
  // Start the freshness window before the read, not after a slow database response.
  const expiresAt = Date.now() + PUBLIC_TTL_SECONDS * 1000;
  const data = projectPublic(await store().read());
  if (edge && !data.demo) {
    const ttl = Math.floor((expiresAt - Date.now()) / 1000);
    if (ttl > 0) {
      const response = Response.json({ expiresAt, data }, { headers: { 'Cache-Control': `public, max-age=${ttl}` } });
      edge.ctx.waitUntil(edge.cache.put(edge.key, response).catch(() => {
        console.warn('Public catalogue cache write failed.');
      }));
    }
  }
  return data;
}

// React deduplicates layout/page reads within one server rendering request.
export const publicData = cache(loadPublicData);

export async function invalidatePublicData(): Promise<void> {
  const edge = await edgeCache();
  if (!edge) return;
  try { await edge.cache.delete(edge.key); }
  catch { console.warn('Public catalogue cache invalidation failed; entries expire within 60 seconds.'); }
  // Cache API deletion affects this location only. Other locations have the bounded TTL.
}
