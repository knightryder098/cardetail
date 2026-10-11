import { test, expect } from '@playwright/test';
test('pricing settings load saved one-time prices for every service and preserve them after editing', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Open demo dashboard' }).click();
  const session = await (await page.request.get('/api/v1/session')).json();
  expect(session.demo).toBe(true);
  const data = await (await page.request.get('/api/v1/admin/data')).json();
  const serviceIds = ['svc-interior-detail', 'svc-paint-correction', 'svc-paint-protection', 'svc-wheel-care'];
  const prices = [
    { code: 'normal', name: 'Normal', amounts: [500, 800, 1200] },
    { code: 'premium', name: 'Premium', amounts: [800, 1200, 1500] },
    { code: 'premium_plus', name: 'Premium+', amounts: [1500, 2000, 3000] },
  ];
  const classes = ['standard', 'premium', 'luxury'];
  for (const id of serviceIds) {
    const service = data.draft.services.find((s: { id: string }) => s.id === id);
    for (const price of prices) {
      const tier = service.tiers.find((t: { code: string }) => t.code === price.code);
      classes.forEach((cls, i) => { tier.prices[cls].one_time = price.amounts[i] * 100; });
    }
  }
  const saved = await page.request.put('/api/v1/admin/catalogue', {
    headers: { Origin: new URL(page.url()).origin }, data: {
    catalogue: data.draft, baseRevisionId: data.activeRevisionId, draftVersion: data.draftVersion,
  }});
  expect(saved.ok(), await saved.text()).toBe(true);
  await page.reload();
  await page.getByRole('link', { name: 'Pricing matrix', exact: true }).click();
  for (const id of serviceIds) {
    await page.getByRole('combobox', { name: /^Service/ }).selectOption(id);
    await page.getByRole('combobox', { name: /^Plan term/ }).selectOption('one_time');
    for (const price of prices) {
      for (const [i, cls] of classes.entries()) {
        await expect(page.getByRole('spinbutton', { name: `${price.name} ${cls} price`, exact: true }))
          .toHaveValue(String(price.amounts[i]));
      }
    }
  }
  const priceField = page.getByRole('spinbutton', { name: 'Normal standard price', exact: true });
  await priceField.fill('550');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await page.reload();
  await page.getByRole('combobox', { name: /^Service/ }).selectOption('svc-wheel-care');
  await expect(priceField).toHaveValue('550');
});
test('a rejected publication preserves the saved draft and allows corrections without reloading', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Open demo dashboard' }).click();
  await page.getByRole('link', { name: 'Pricing matrix', exact: true }).click();
  const price = page.getByRole('spinbutton', { name: 'Normal standard price', exact: true });
  const originalPrice = await price.inputValue();
  await price.fill('');
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /missing standard .* price/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved. Publication was blocked' })).toBeVisible();
  await price.fill(originalPrice);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Published' })).toBeVisible();
});
test('owner can publish consultation-only mode and restore the complete booking flow', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Open demo dashboard' }).click();
  await page.getByRole('link', { name: 'Pricing matrix', exact: true }).click();
  const price = page.getByRole('spinbutton', { name: 'Normal standard price', exact: true });
  const originalPrice = await price.inputValue();
  await price.fill('');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await page.getByRole('link', { name: 'Studio schedule', exact: true }).click();
  await expect(page.getByText('Ready to enable online booking.', { exact: true })).toBeVisible();
  const enabled = page.getByLabel('Enable online booking', { exact: true });
  await expect(enabled).toBeChecked();
  await enabled.uncheck();
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Published' })).toBeVisible();
  await page.goto('/booking');
  await expect(page.getByRole('heading', { name: 'GOOD CARE IS ON ITS WAY.' })).toBeVisible();
  await page.goto('/admin/schedule');
  await page.getByLabel('Enable online booking', { exact: true }).check();
  await expect(page.getByText('Ready to enable online booking.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await page.goto('/booking');
  await expect(page.getByRole('heading', { name: 'GOOD CARE IS ON ITS WAY.' })).toBeVisible();
  await page.goto('/admin/schedule');
  await expect(page.getByLabel('Enable online booking', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Published' })).toBeVisible();
  await page.goto('/booking');
  await expect(page.getByLabel('Car make')).toBeVisible();
  // The unrelated incomplete price draft stayed private throughout schedule publication.
  await page.goto('/admin/prices');
  await expect(page.getByRole('spinbutton', { name: 'Normal standard price', exact: true })).toHaveValue('');
  await page.getByRole('spinbutton', { name: 'Normal standard price', exact: true }).fill(originalPrice);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
});
test('homepage SHOP entrance works with reduced motion and on mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 360, height: 800 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MAKE EVERY DRIVE SHINE.' })).toBeVisible();
  await page.getByRole('link', { name: 'Enter shop and browse detailing services' }).click();
  await expect(page.getByRole('heading', { name: 'GOOD CARE. GREAT FEELING.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
test('customer selects multiple services and books a combined monthly pack', async ({ page }) => {
  await page.goto('/booking');
  await page.getByLabel('Car make').selectOption('Maruti Suzuki'); await page.getByLabel('Car model').selectOption('veh-swift'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const exterior = page.getByRole('button', { name: /Exterior Detail/ }); const interior = page.getByRole('button', { name: /Interior Detail/ });
  await exterior.click(); await interior.click();
  await expect(exterior).toHaveAttribute('aria-pressed', 'true'); await expect(interior).toHaveAttribute('aria-pressed', 'true');
  await interior.click(); await expect(interior).toHaveAttribute('aria-pressed', 'false'); await interior.click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /Monthly care/ }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('button[aria-label^="Choose date"]:not(:disabled)').first().click(); await page.getByRole('button', { name: /Available at/ }).first().click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Full name').fill('Demo customer'); await page.getByLabel('Email address').fill(`customer-${Date.now()}@example.com`); await page.getByLabel('Mobile number').fill('9000000000'); await page.getByLabel('I agree to the booking terms').check();
  await page.getByRole('button', { name: 'Send verification code' }).click();
  const code = await page.getByTestId('demo-code').textContent(); await page.getByLabel('Verification code').fill(code!); await page.getByRole('button', { name: 'Verify email' }).click();
  await page.getByRole('button', { name: 'Confirm appointment' }).click();
  await expect(page.getByRole('heading', { name: "YOU’RE ALL BOOKED." })).toBeVisible(); await expect(page.getByText('Your pack activates after payment at the studio.')).toBeVisible();
  await expect(page.getByText('Exterior Detail + Interior Detail · Normal', { exact: true })).toBeVisible();
  await expect(page.getByText('3 hr', { exact: true })).toBeVisible();
});
test('a failed availability request removes times from the previous day', async ({ page }) => {
  await page.goto('/booking');
  await page.getByLabel('Car make').selectOption('Maruti Suzuki'); await page.getByLabel('Car model').selectOption('veh-swift'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /Exterior Detail/ }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const days = page.locator('button[aria-label^="Choose date"]:not(:disabled)'); await days.first().click();
  await expect(page.getByRole('button', { name: /Available at/ }).first()).toBeVisible();
  await page.route('**/api/v1/availability?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Availability temporarily unavailable' } }) }));
  await days.nth(1).click();
  await expect(page.getByText('Availability temporarily unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Available at/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
});
test('owner can edit a draft and publish it without changing public content early', async ({ page }) => {
  await page.goto('/admin'); await page.getByRole('button', { name: 'Open demo dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'A GOOD DAY FOR GREAT CARE.' })).toBeVisible();
  await page.getByRole('link', { name: 'Site editor', exact: true }).click();
  const originalTagline = await page.getByLabel('Tagline').inputValue();
  const title = `Precision care ${Date.now()}`; await page.getByLabel('Tagline').fill(title); await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status').filter({hasText:'Draft saved'})).toBeVisible(); await page.getByRole('button', { name: 'Publish changes', exact: true }).click(); await expect(page.getByRole('status').filter({hasText:'Published'})).toBeVisible();
  await page.goto('/'); await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await page.goto('/admin'); await page.getByRole('link', { name: 'Site editor', exact: true }).click();
  await page.getByLabel('Tagline').fill(originalTagline); await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status').filter({hasText:'Draft saved'})).toBeVisible(); await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  await expect(page.getByRole('status').filter({hasText:'Published'})).toBeVisible();
});
