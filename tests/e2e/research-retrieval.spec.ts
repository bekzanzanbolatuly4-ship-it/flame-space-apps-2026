import { test, expect } from '@playwright/test';

test('Research retrieves individual NASA rows and renders honest fallback with links', async ({ page, request }, info) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  const search = page.getByLabel('Search verified evidence');
  await search.fill('FLEX-001');
  await expect(page.locator('.research-record').first()).toContainText('1.69 mm');
  await page.getByRole('button', { name: /Build fire-safety evidence brief/ }).click();
  await expect(page.getByRole('article', { name: 'Fire safety evidence brief' })).toContainText('0.52 mm²/s');
  await page.getByRole('button', { name: 'Use as comparison B ↘' }).first().click();
  await expect(page.locator('.comparison-result')).toContainText('Qualitative');
  const config = await (await request.get('/api/ask')).json();
  // Exactly one live provider request across both projects; mobile tests deterministic rejection.
  const question = process.env.FLAME_LIVE_RESEARCH === '1' && info.project.name === 'desktop' ? 'FLEX-001 initial droplet diameter' : 'FLEX-001 exact flame temperature';
  await page.getByRole('region', { name: 'Research', exact: true }).getByRole('button', { name: 'Ask FLAME', exact: true }).click();
  await page.getByLabel('Your question').fill(question);
  const started = Date.now();
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/ask') && response.request().method() === 'POST', { timeout: 55000 });
  await page.getByRole('dialog').getByRole('button', { name: 'Ask FLAME', exact: true }).click();
  const response = await responsePromise;
  const payload = await response.json();
  console.log(JSON.stringify({ model: config.model, status: response.status(), kind: payload.kind, reason: payload.providerError, latencyMs: Date.now()-started, citations: payload.sources?.length }));
  expect(payload.sources?.length).toBeGreaterThan(0);
  await expect(page.locator('.ai-source-links a').first()).toHaveAttribute('href', /ntrs.nasa.gov.*20150023456/);
  await expect(page.locator('.ai-result')).toContainText('1.69');
  await page.screenshot({ path: `output/playwright/research-retrieval-${info.project.name}.png` });
});
