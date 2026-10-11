import { z } from 'zod';
import type { Catalogue, Tier } from './types';
import { catalogueSchema, serviceSchema, tierSchema } from './schema';

export const catalogueSections = ['services', 'products', 'vehicles', 'prices', 'packages', 'schedule', 'site'] as const;
export const catalogueSectionSchema = z.enum(catalogueSections);
export type CatalogueSection = typeof catalogueSections[number];
const servicesSchema = z.array(serviceSchema.extend({ tiers: z.array(tierSchema.omit({ prices: true }).strip()).min(1).max(3) })).max(50);
const pricingSchema = catalogueSchema.pick({ taxMode: true, taxBps: true }).strip().extend({
  services: z.array(z.object({ id: z.string(), tiers: z.array(tierSchema.pick({ code: true, prices: true }).strip()).min(1).max(3) })).max(50),
});
const blankPrices = (): Tier['prices'] => ({ standard: { one_time: null, monthly: null, annual: null }, premium: { one_time: null, monthly: null, annual: null }, luxury: { one_time: null, monthly: null, annual: null } });

export function catalogueSectionSnapshot(c: Catalogue, section: CatalogueSection): unknown {
  if (section === 'packages') return c.plans;
  if (section === 'schedule') return { schedule: c.schedule, bookingEnabled: c.bookingEnabled };
  if (section === 'prices') return { taxMode: c.taxMode, taxBps: c.taxBps, services: c.services.map(s => ({ id: s.id, tiers: s.tiers.map(t => ({ code: t.code, prices: t.prices })) })) };
  if (section === 'services') return c.services.map(s => ({ ...s, tiers: s.tiers.map(({ prices: _prices, ...tier }) => tier) }));
  return c[section];
}

export function mergeCatalogueSection(base: Catalogue, input: unknown, section: CatalogueSection): Catalogue {
  const next = structuredClone(base);
  if (section === 'prices') {
    const prices = pricingSchema.parse(input);
    next.taxMode = prices.taxMode; next.taxBps = prices.taxBps;
    for (const service of next.services) for (const tier of service.tiers) {
      const price = prices.services.find(s => s.id === service.id)?.tiers.find(t => t.code === tier.code)?.prices;
      if (price) tier.prices = structuredClone(price);
    }
  } else if (section === 'services') {
    const { services } = z.object({ services: servicesSchema }).parse(input);
    const source = z.object({ services: z.array(z.object({ id: z.string(), tiers: z.array(z.object({ code: z.string(), prices: z.unknown().optional() })) })) }).parse(input);
    // Editing service information must not overwrite another page's saved prices.
    next.services = services.map(service => ({ ...service, tiers: service.tiers.map(tier => {
      const existing = base.services.find(s => s.id === service.id)?.tiers.find(t => t.code === tier.code);
      // New services/tiers need their own saved pricing when first published.
      const addedPrices = source.services.find(s => s.id === service.id)?.tiers.find(t => t.code === tier.code)?.prices;
      return { ...tier, prices: structuredClone(existing?.prices ?? tierSchema.shape.prices.parse(addedPrices ?? blankPrices())) };
    }) }));
  } else if (section === 'packages') {
    next.plans = catalogueSchema.pick({ plans: true }).strip().parse(input).plans;
  } else if (section === 'schedule') {
    const schedule = catalogueSchema.pick({ schedule: true, bookingEnabled: true }).strip().parse(input);
    next.schedule = schedule.schedule; next.bookingEnabled = schedule.bookingEnabled;
  } else if (section === 'site') {
    next.site = catalogueSchema.pick({ site: true }).strip().parse(input).site;
  } else if (section === 'products') {
    next.products = catalogueSchema.pick({ products: true }).strip().parse(input).products;
  } else {
    next.vehicles = catalogueSchema.pick({ vehicles: true }).strip().parse(input).vehicles;
  }
  return next;
}
