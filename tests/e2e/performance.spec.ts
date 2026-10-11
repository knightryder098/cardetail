import { expect, test } from '@playwright/test';

test('public pages load only the two required self-hosted variable fonts', async ({ page }) => {
  const fontRequests = new Set<string>();
  page.on('request', request => {
    if (request.resourceType() === 'font') fontRequests.add(request.url());
  });
  await page.goto('/');
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(fontRequests.size).toBe(2);
  for (const url of fontRequests) {
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);
    expect(new URL(url).pathname).toMatch(/\/_next\/static\/media\/.+\.woff2$/);
  }
  const faces = await page.evaluate(() => Array.from(document.fonts).map(font => ({
    family: font.family.replaceAll('"', '').replaceAll("'", ''), weight: font.weight, status: font.status,
  })));
  expect(faces).toEqual(expect.arrayContaining([
    expect.objectContaining({ family: 'Manrope', weight: '200 800', status: 'loaded' }),
    expect.objectContaining({ family: 'Space Grotesk', weight: '300 700', status: 'loaded' }),
  ]));
  await page.goto('/services');
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(fontRequests.size).toBe(2);
});
