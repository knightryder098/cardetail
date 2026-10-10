import type { PublicData, State } from '@/lib/types';
import { createCatalogue } from './seed';
import { isDemo, store } from './store';
export function projectPublic(s: State): PublicData {
  const revision = s.revisions.find(r => r.id === s.activeRevisionId);
  if (!revision) { const empty = createCatalogue(false); empty.services = []; empty.products = []; empty.vehicles = []; empty.plans = []; return { catalogue: empty, revision: 0, demo: isDemo() }; }
  const c = structuredClone(revision.catalogue); c.services = c.services.filter(s => s.enabled).map(s => ({ ...s, tiers: s.tiers.filter(t => t.enabled) })); c.vehicles = c.vehicles.filter(v => v.reviewed); c.plans = c.plans.filter(p => p.enabled);
  return { catalogue: c, revision: revision.number, demo: isDemo() };
}
export async function publicData() { return projectPublic(await store().read()); }
