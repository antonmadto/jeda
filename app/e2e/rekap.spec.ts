import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { formatRupiah } from '../src/lib/format'

// Butuh kredensial akun test: E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

async function login(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Kata sandi').fill(password!)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
}

test('rekap harian tampil, tambah lalu hapus pengeluaran, laba kotor menyesuaikan', async ({
  page,
}) => {
  test.skip(!email || !password, 'butuh E2E_EMAIL dan E2E_PASSWORD')
  await login(page)
  await page.getByRole('link', { name: 'Rekap' }).click()

  await expect(page.getByText('Rekap Harian JE&DA')).toBeVisible()
  const labaBefore = await page.getByTestId('laba-kotor').textContent()

  // tambah pengeluaran bensin 12.345 (exact: hindari match tombol "Hapus pengeluaran Bensin"
  // yang muncul bila ada pengeluaran bensin asli hari itu)
  await page.getByRole('button', { name: 'Bensin', exact: true }).click()
  await page.getByLabel('Jumlah pengeluaran').fill('12345')
  await page.getByRole('button', { name: 'Tambah' }).click()

  // muncul di daftar pengeluaran
  await expect(page.getByText(formatRupiah(12345))).toBeVisible()
  // laba kotor berubah (berkurang)
  await expect(page.getByTestId('laba-kotor')).not.toHaveText(labaBefore ?? '')

  // hapus lagi supaya data bersih — .first() = terbaru = milik test ini,
  // bukan pengeluaran bensin asli pemilik
  await page.getByRole('button', { name: 'Hapus pengeluaran Bensin' }).first().click()
  await expect(page.getByTestId('laba-kotor')).toHaveText(labaBefore ?? '', { timeout: 10_000 })
})

test('tombol bagikan menghasilkan file PNG (fallback unduh)', async ({ page }) => {
  test.skip(!email || !password, 'butuh E2E_EMAIL dan E2E_PASSWORD')
  // Paksa jalur fallback unduh supaya deterministik lintas browser
  // (WebKit punya Web Share API dengan file, Chromium tidak).
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  })
  await login(page)
  await page.getByRole('link', { name: 'Rekap' }).click()
  await expect(page.getByText('Rekap Harian JE&DA')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Bagikan Rekap ke WhatsApp' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^rekap-\d{4}-\d{2}-\d{2}\.png$/)
  // file PNG benar-benar berisi data
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  const buf = Buffer.concat(chunks)
  expect(buf.length).toBeGreaterThan(1000)
  // signature PNG: 89 50 4E 47
  expect(buf.subarray(0, 4).toString('hex')).toBe('89504e47')
})

test('rekap bulanan menampilkan repeat customer rate', async ({ page }) => {
  test.skip(!email || !password, 'butuh E2E_EMAIL dan E2E_PASSWORD')
  await login(page)
  await page.getByRole('link', { name: 'Rekap' }).click()
  await page.getByRole('radio', { name: 'Bulanan' }).click()
  await expect(page.getByText('Pelanggan Berulang')).toBeVisible()
  await expect(page.getByText('Tren Omzet')).toBeVisible()
})
