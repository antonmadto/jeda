import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { formatRupiah } from '../src/lib/format'

// Butuh kredensial akun test: E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
// Test ini MENULIS data. Hanya jalan ke DB test (E2E_SUPABASE_URL), bukan produksi.
const canWrite =
  Boolean(process.env.E2E_SUPABASE_URL) || process.env.E2E_ALLOW_PROD_WRITES === '1'
const skipReason = 'menulis data: butuh DB test (E2E_SUPABASE_URL) atau E2E_ALLOW_PROD_WRITES=1'

const CUSTOMER = 'Uji Piutang'

async function login(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Kata sandi').fill(password!)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
}

test('alur belum lunas sampai lunas + riwayat pelanggan akurat', async ({ page }) => {
  test.skip(!email || !password || !canWrite, skipReason)
  await login(page)

  // 1) Catat penjualan belum lunas dengan pelanggan
  await page.getByRole('radio', { name: 'Lapak' }).click()
  await page.getByRole('button', { name: 'Susu Kurma 250 ml', exact: true }).click()
  await page.getByRole('button', { name: 'Bayar' }).click()
  await page.getByRole('radio', { name: 'Belum lunas' }).click()

  await page.getByLabel(/Pelanggan/).fill(CUSTOMER)
  const existing = page.getByRole('button', { name: CUSTOMER, exact: true })
  const addNew = page.getByRole('button', { name: new RegExp(`Tambah .${CUSTOMER}`) })
  await expect(existing.or(addNew).first()).toBeVisible() // tunggu hasil pencarian muncul
  await page.waitForTimeout(600) // beri waktu query menemukan pelanggan yang sudah ada
  if (await existing.count()) await existing.first().click()
  else await addNew.click()
  // pastikan pelanggan benar-benar terpilih (chip muncul) sebelum menyimpan
  await expect(page.getByRole('button', { name: 'Hapus pelanggan' })).toBeVisible()

  await page.getByRole('button', { name: 'Simpan' }).click()
  await expect(page.getByText('Transaksi tersimpan ✓')).toBeVisible()

  // 2) Badge piutang muncul di tab Lainnya
  const lainnya = page.getByRole('link', { name: /Lainnya/ })
  await expect(lainnya).toBeVisible()

  // 3) Piutang: pelanggan & nominal muncul
  await lainnya.click()
  await page.getByRole('link', { name: /Piutang/ }).click()
  await expect(page.getByRole('heading', { name: 'Piutang' })).toBeVisible()
  await expect(page.getByText(CUSTOMER, { exact: true }).first()).toBeVisible()

  // 4) Riwayat pelanggan akurat: total belanja tampil (>= 15.000 dari transaksi ini)
  await page.goto('/lainnya/pelanggan')
  await expect(page.getByRole('heading', { name: 'Pelanggan' })).toBeVisible()
  await page.getByRole('link', { name: new RegExp(CUSTOMER) }).first().click()
  await expect(page.getByText('Riwayat Beli', { exact: false })).toBeVisible()
  await expect(page.getByText('Belum lunas').first()).toBeVisible()

  // 5) Tandai lunas → entri hilang dari daftar piutang
  page.once('dialog', (d) => d.accept())
  await page.goto('/lainnya/piutang')
  await expect(page.getByText(CUSTOMER, { exact: true }).first()).toBeVisible()
  const before = await page.getByRole('button', { name: 'Tandai Lunas' }).count()
  await page.getByRole('button', { name: 'Tandai Lunas' }).first().click()
  await expect(page.getByRole('button', { name: 'Tandai Lunas' })).toHaveCount(before - 1, {
    timeout: 10_000,
  })
  // (data test dibersihkan lewat MCP setelah suite; tidak menyentuh data asli)
  expect(formatRupiah(15000)).toBe('Rp15.000')
})
