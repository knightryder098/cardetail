import type { Catalogue } from './types';

export function validatePublication(c: Catalogue): string[] {
  const errors: string[] = [];
  for (const key of ['services', 'products', 'vehicles'] as const) {
    const ids = c[key].map(item => item.id); if (new Set(ids).size !== ids.length) errors.push(`Duplicate ${key} identifiers.`);
  }
  if (new Set(c.services.map(s => s.slug)).size !== c.services.length) errors.push('Service addresses must be unique.');
  if (new Set(c.plans.map(p => p.code)).size !== c.plans.length) errors.push('Plan terms must be unique.');
  if (c.bookingEnabled && !c.services.some(s => s.enabled)) errors.push('Enable at least one service before enabling booking.');
  if (c.bookingEnabled && !c.plans.some(p => p.enabled)) errors.push('Enable at least one care plan before enabling booking.');
  if (c.bookingEnabled && new Set(c.schedule.closedWeekdays).size === 7) errors.push('Open at least one weekday before enabling booking.');
  if (c.bookingEnabled && !c.vehicles.some(v => v.reviewed)) errors.push('Review at least one vehicle before enabling booking.');
  for (const p of c.plans.filter(p => p.enabled)) if (p.code !== 'one_time' && (!p.validityDays || !p.visits)) errors.push(`${p.name}: define visits and validity.`);
  for (const s of c.services.filter(s => s.enabled)) {
    if (!s.tiers.some(t => t.enabled)) errors.push(`${s.name}: enable at least one tier.`);
    if (new Set(s.tiers.map(t => t.code)).size !== s.tiers.length) errors.push(`${s.name}: tier codes must be unique.`);
    for (const t of s.tiers.filter(t => t.enabled)) {
      if (t.productIds.some(id => !c.products.some(p => p.id === id))) errors.push(`${s.name} ${t.name}: select existing materials.`);
      if (t.minutes + c.schedule.bufferMinutes > (c.schedule.closes - c.schedule.opens) * 60) errors.push(`${s.name} ${t.name}: duration exceeds the working day.`);
      if (c.bookingEnabled) for (const cls of [...new Set(c.vehicles.filter(v => v.reviewed).map(v => v.pricingClass))]) for (const p of c.plans.filter(p => p.enabled)) if (!t.prices[cls][p.code]) errors.push(`${s.name} ${t.name}: missing ${cls} ${p.name} price.`);
    }
  }
  return errors;
}
