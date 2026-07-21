import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Butuh kredensial akun test: E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
// Semua test di sini BACA-SAJA (hanya membaca data via finance.ts, tidak menulis
// apa pun), jadi aman dijalankan terhadap produksi seperti rekap/pelanggan.
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

async function login(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Kata sandi').fill(password!)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
}

test('laporan investor tampil dari tab Lainnya (baca-saja)', async ({ page }) => {
  test.skip(!email || !password, 'butuh E2E_EMAIL dan E2E_PASSWORD')
  await login(page)
  await page.getByRole('link', { name: 'Lainnya' }).click()
  await page.getByRole('link', { name: 'Laporan Investor' }).click()

  await expect(page.getByRole('heading', { name: 'Laporan Investor' })).toBeVisible()
  // pratinjau selesai dimuat: kartu ringkasan & bagian utama tampil
  await expect(page.getByRole('heading', { name: 'Ringkasan Eksekutif' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { name: 'Laba Rugi (Akrual)' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Metodologi' })).toBeVisible()

  // tombol unduh tersedia (target ketuk ≥44px lewat h-[54px])
  await expect(page.getByRole('button', { name: 'Unduh PDF' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unduh JSON' })).toBeVisible()
})

test('unduh JSON menghasilkan file skema berversi (baca-saja)', async ({ page }) => {
  test.skip(!email || !password, 'butuh E2E_EMAIL dan E2E_PASSWORD')
  await login(page)
  await page.goto('/lainnya/laporan')
  await expect(page.getByRole('heading', { name: 'Ringkasan Eksekutif' })).toBeVisible({
    timeout: 15_000,
  })

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Unduh JSON' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^jeda-laporan-investor_.*\.json$/)

  // isi JSON valid & berversi
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  expect(parsed.reportVersion).toBe(1)
  expect(parsed.businessProfile?.nama).toBe('JE&DA')
  expect(parsed).toHaveProperty('ringkasanEksekutif.omzet')
  expect(parsed).toHaveProperty('labaRugi')
  expect(parsed).toHaveProperty('arusKas')
})
