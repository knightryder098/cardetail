import { expect, it } from 'vitest';
import { createCatalogue } from '@/server/seed';
import { serviceSaveIssues } from '@/lib/service-validation';

it('requires offered prices even when online booking is turned off', () => {
  const c = createCatalogue(true); c.bookingEnabled = false;
  c.services[0].tiers[0].prices.luxury.monthly = null;
  expect(serviceSaveIssues(c)).toContainEqual(expect.objectContaining({ section: 'services', pricingClass: 'luxury', planCode: 'monthly' }));
});
it('allows blank inactive offers but validates provided prices', () => {
  const c = createCatalogue(true); c.services[0].enabled = false;
  c.services[0].tiers[0].prices.standard.one_time = null;
  expect(serviceSaveIssues(c)).toEqual([]);
  c.services[0].tiers[0].prices.standard.one_time = -1;
  expect(serviceSaveIssues(c)[0].message).toContain('prices / standard / one_time');
});
it('checks all required service fields and uses live plan dependencies', () => {
  const live = createCatalogue(true); live.plans[1].enabled = false;
  const draft = structuredClone(live); draft.plans[1].enabled = true;
  draft.services[0].tiers[0].prices.standard.monthly = null;
  expect(serviceSaveIssues(draft, live)).toEqual([]);
  draft.services[0].name = '';
  draft.services[0].tiers[0].minutes = 0;
  draft.services[0].tiers[0].features = [];
  expect(serviceSaveIssues(draft, live)).toHaveLength(3);
});
it('reports invalid references and durations on the service page', () => {
  const c = createCatalogue(true);
  c.services[0].tiers[0].productIds = ['nonexistent'];
  c.services[0].tiers[0].minutes = 600;
  c.schedule.closes = c.schedule.opens + 1;
  const issues = serviceSaveIssues(c);
  expect(issues.some(i => i.message.includes('existing materials'))).toBe(true);
  expect(issues.some(i => i.message.includes('working day'))).toBe(true);
  expect(issues.every(i => i.section === 'services')).toBe(true);
});
