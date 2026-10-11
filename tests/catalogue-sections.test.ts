import { expect, it } from 'vitest';
import { createCatalogue } from '@/server/seed';
import { mergeCatalogueSection } from '@/lib/catalogue-sections';

it('saves care packages without validating or changing unrelated unsaved fields', () => {
  const saved = createCatalogue(true);
  const edited = structuredClone(saved);
  edited.plans[1].name = 'Monthly studio care';
  edited.site.name = '';
  edited.services[0].tiers[0].prices.standard.one_time = 0;
  const result = mergeCatalogueSection(saved, edited, 'packages');
  expect(result.plans[1].name).toBe('Monthly studio care');
  expect(result.site).toEqual(saved.site);
  expect(result.services).toEqual(saved.services);
});
it('validates fields on the page being saved', () => {
  const saved = createCatalogue(true);
  const edited = structuredClone(saved); edited.plans[1].visits = 0;
  expect(() => mergeCatalogueSection(saved, edited, 'packages')).toThrow();
});
it('saves prices without changing service descriptions or other pages', () => {
  const saved = createCatalogue(true);
  const edited = structuredClone(saved);
  edited.services[0].name = 'An unsaved service rename';
  edited.services[0].tiers[0].prices.standard.one_time = 123400;
  edited.site.tagline = 'An unsaved tagline';
  const result = mergeCatalogueSection(saved, edited, 'prices');
  expect(result.services[0].tiers[0].prices.standard.one_time).toBe(123400);
  expect(result.services[0].name).toBe(saved.services[0].name);
  expect(result.site).toEqual(saved.site);
});
it('saves service prices together with service information', () => {
  const saved = createCatalogue(true);
  const edited = structuredClone(saved);
  edited.services[0].name = 'Exterior care';
  edited.services[0].tiers[0].prices.standard.one_time = 1;
  const result = mergeCatalogueSection(saved, edited, 'services');
  expect(result.services[0].name).toBe('Exterior care');
  expect(result.services[0].tiers[0].prices.standard.one_time).toBe(1);
});
