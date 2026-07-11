import { expect, test } from '@playwright/test'

test('tanpa login: halaman masuk tampil di viewport 390 px', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'JE&DA' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Kata sandi')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible()
})

// Test alur login penuh, jalan kalau kredensial test tersedia:
// E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test('login lalu bottom nav 4 tab tampil dan katalog termuat', async ({ page }) => {
  test.skip(!email || !password, 'butuh E2E_EMAIL dan E2E_PASSWORD')
  await page.goto('/')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Kata sandi').fill(password!)
  await page.getByRole('button', { name: 'Masuk' }).click()

  const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
  await expect(nav).toBeVisible()
  for (const label of ['Jual', 'Stok', 'Rekap', 'Lainnya']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible()
  }
  // katalog dari seed tampil
  await expect(page.getByText('Susu Kurma', { exact: true })).toBeVisible()
})
