import type { Catalogue, PlanCode, PricingClass, TierCode } from './types';
import type { CatalogueSection } from './catalogue-sections';
export type CatalogueIssue = { section: CatalogueSection; message: string; serviceId?: string; tierCode?: TierCode; planCode?: PlanCode; pricingClass?: PricingClass };


export function publicationIssues(c: Catalogue): CatalogueIssue[] {
  const errors: CatalogueIssue[] = [];
  const add = (section: CatalogueSection, message: string, fields: Partial<CatalogueIssue> = {}) => errors.push({ ...fields, section, message });
  for (const key of ['services', 'products', 'vehicles'] as const) {
    const ids = c[key].map(item => item.id); if (new Set(ids).size !== ids.length) add(key, `Duplicate ${key} identifiers.`);
  }
  if (new Set(c.services.map(s => s.slug)).size !== c.services.length) add('services', 'Service addresses must be unique.');
  if (new Set(c.plans.map(p => p.code)).size !== c.plans.length) add('packages', 'Plan terms must be unique.');
  if (c.bookingEnabled && !c.services.some(s => s.enabled)) add('services', 'Enable at least one service before enabling booking.');
  if (c.bookingEnabled && !c.plans.some(p => p.enabled)) add('packages', 'Enable at least one care plan before enabling booking.');
  if (c.bookingEnabled && new Set(c.schedule.closedWeekdays).size === 7) add('schedule', 'Open at least one weekday before enabling booking.');
  if (c.bookingEnabled && !c.vehicles.some(v => v.reviewed)) add('vehicles', 'Review at least one vehicle before enabling booking.');
  for (const p of c.plans.filter(p => p.enabled)) if (p.code !== 'one_time' && (!p.validityDays || !p.visits)) add('packages', `${p.name}: define visits and validity.`, { planCode: p.code });
  for (const s of c.services.filter(s => s.enabled)) {
    if (!s.tiers.some(t => t.enabled)) add('services', `${s.name}: enable at least one tier.`, { serviceId: s.id });
    if (new Set(s.tiers.map(t => t.code)).size !== s.tiers.length) add('services', `${s.name}: tier codes must be unique.`, { serviceId: s.id });
    for (const t of s.tiers.filter(t => t.enabled)) {
      if (t.productIds.some(id => !c.products.some(p => p.id === id))) add('products', `${s.name} ${t.name}: select existing materials.`, { serviceId: s.id, tierCode: t.code });
      if (t.minutes + c.schedule.bufferMinutes > (c.schedule.closes - c.schedule.opens) * 60) add('schedule', `${s.name} ${t.name}: duration exceeds the working day.`, { serviceId: s.id, tierCode: t.code });
      if (c.bookingEnabled) for (const cls of [...new Set(c.vehicles.filter(v => v.reviewed).map(v => v.pricingClass))]) for (const p of c.plans.filter(p => p.enabled)) if (!t.prices[cls][p.code]) add('prices', `${s.name} ${t.name}: missing ${cls} ${p.name} price.`, { serviceId: s.id, tierCode: t.code, pricingClass: cls, planCode: p.code });
    }
  }
  return errors;
}

export function validatePublication(c: Catalogue): string[] {
  return publicationIssues(c).map(issue => issue.message);
}
