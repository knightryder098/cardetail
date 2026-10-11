import { expect, test } from '@playwright/test';

test('care-package publication leaves unrelated incomplete pricing drafts private', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Open demo dashboard' }).click();
  await expect(page.getByRole('link', { name: 'Care packages', exact: true })).toBeVisible();
  const original = await (await page.request.get('/api/v1/admin/data')).json();
  const liveBefore = await (await page.request.get('/api/v1/public/site')).json();
  const draft = structuredClone(original.draft);
  draft.services[0].tiers[0].prices.standard.monthly = null;
  const saved = await page.request.put('/api/v1/admin/catalogue', { headers: { Origin: new URL(page.url()).origin }, data: { section: 'prices', catalogue: draft, baseRevisionId: original.activeRevisionId, draftVersion: original.draftVersion } });
  expect(saved.ok()).toBe(true);
  await page.goto('/admin/packages');
  const name = page.getByLabel('Pack name', { exact: true }).nth(1);
  const oldName = await name.inputValue();
  await name.fill('Monthly independent care');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await expect(page.locator('.admin-content').getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Published' })).toBeVisible();
  const liveAfter = await (await page.request.get('/api/v1/public/site')).json();
  expect(liveAfter.catalogue.plans.find((p: { code: string }) => p.code === 'monthly').name).toBe('Monthly independent care');
  expect(liveAfter.catalogue.services).toEqual(liveBefore.catalogue.services);
  const current = await (await page.request.get('/api/v1/admin/data')).json();
  expect(current.draft.services[0].tiers[0].prices.standard.monthly).toBeNull();
  expect(current.pendingSections).toContain('prices');
  await name.fill(oldName);
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Published' })).toBeVisible();
  const restored = await (await page.request.get('/api/v1/admin/data')).json();
  expect((await page.request.put('/api/v1/admin/catalogue', { headers: { Origin: new URL(page.url()).origin }, data: { section: 'prices', catalogue: original.draft, baseRevisionId: restored.activeRevisionId, draftVersion: restored.draftVersion } })).ok()).toBe(true);
});

test('enabling a care plan shows all missing published prices and succeeds after publishing them', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Open demo dashboard' }).click();
  await expect(page.getByRole('link', { name: 'Care packages', exact: true })).toBeVisible();
  const original = await (await page.request.get('/api/v1/admin/data')).json();
  const origin = new URL(page.url()).origin;
  async function saveAndPublish(catalogue: unknown, section: string) {
    const data = await (await page.request.get('/api/v1/admin/data')).json();
    const save = await page.request.put('/api/v1/admin/catalogue', { headers: { Origin: origin }, data: { section, catalogue, baseRevisionId: data.activeRevisionId, draftVersion: data.draftVersion } });
    expect(save.ok(), await save.text()).toBe(true);
    const version = await save.json();
    const publish = await page.request.post('/api/v1/admin/publish', { headers: { Origin: origin }, data: { section, baseRevisionId: data.activeRevisionId, draftVersion: version.draftVersion } });
    expect(publish.ok(), await publish.text()).toBe(true);
  }
  const draft = structuredClone(original.draft);
  draft.plans.find((p: { code: string }) => p.code === 'monthly').enabled = false;
  await saveAndPublish(draft, 'packages');
  for (const service of draft.services) for (const tier of service.tiers) for (const cls of ['standard', 'premium', 'luxury']) tier.prices[cls].monthly = null;
  await saveAndPublish(draft, 'prices');
  await page.goto('/admin/packages');
  await page.getByLabel('Offer this care plan').nth(1).check();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  const issues = page.getByRole('alert').filter({ hasText: 'Required before this page can be published' });
  await expect(issues).toBeVisible();
  await expect(issues.getByText(`Exterior Detail Normal: missing standard ${original.draft.plans.find((p: { code: string }) => p.code === 'monthly').name} price.`, { exact: true })).toBeVisible();
  await expect(issues.getByRole('link', { name: /Pricing matrix/ })).toBeVisible();
  expect(await issues.locator('li').count()).toBeGreaterThan(8);
  await saveAndPublish(original.draft, 'prices');
  await page.reload();
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Published' })).toBeVisible();
});
