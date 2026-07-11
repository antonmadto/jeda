import { expect, test } from '@playwright/test'

test('bottom nav tampil dengan 4 tab di viewport 390 px', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
  await expect(nav).toBeVisible()
  for (const label of ['Jual', 'Stok', 'Rekap', 'Lainnya']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible()
  }
})
