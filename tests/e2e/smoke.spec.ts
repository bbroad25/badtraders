import { test, expect } from '@playwright/test';

test('homepage loads and shows title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Bad Traders/i);
});

test('farcaster manifest available at well-known', async ({ request }) => {
  const res = await request.get('/.well-known/farcaster.json');
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json?.miniapp?.canonicalDomain).toBe('badtraders.xyz');
});


