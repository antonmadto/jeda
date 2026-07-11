import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { computePrice } from '../src/lib/pricing'
import { formatRupiah } from '../src/lib/format'

// Test alur penjualan nyata terhadap Supabase sungguhan.
// Butuh kredensial: E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
// Transaksi yang dibuat akan dihapus lagi lewat UI (stok kembali seperti semula).

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

async function login(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Kata sandi').fill(password!)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
}

async function deleteNewestSale(page: Page) {
  const list = page.getByRole('region', { name: 'Transaksi hari ini' })
  const hapusButtons = list.getByRole('button', { name: 'Hapus' })
  const before = await hapusButtons.count()
  page.once('dialog', (d) => d.accept())
  await hapusButtons.first().click()
  await expect(hapusButtons).toHaveCount(before - 1, { timeout: 10_000 })
}

test('transaksi lapak: 1 botol Immune 500 ml, cash lunas, muncul di daftar lalu dihapus', async ({
  page,
}) => {
  test.skip(!email || !password, 'butuh E2E_EMAIL dan E2E_PASSWORD')
  await login(page)

  await page.getByRole('radio', { name: 'Lapak' }).click()
  await page.getByRole('button', { name: 'Immune 500 ml' }).click()

  // total harus persis hasil mesin harga untuk hari ini
  const expected = computePrice(
    [{ variantId: 'x', category: 'fresh', price: 38000, qty: 1 }],
    'lapak',
    new Date(),
  )
  await expect(page.getByTestId('cart-total')).toHaveText(formatRupiah(expected.total))

  await page.getByRole('button', { name: 'Bayar' }).click()
  await page.getByRole('button', { name: 'Simpan' }).click()
  await expect(page.getByText('Transaksi tersimpan ✓')).toBeVisible()

  const list = page.getByRole('region', { name: 'Transaksi hari ini' })
  await expect(list.getByText(formatRupiah(expected.total)).first()).toBeVisible()

  await deleteNewestSale(page)
})

test('transaksi bulk 50 pcs: diskon 1.000/botol terhitung dan tersimpan', async ({ page }) => {
  test.skip(!email || !password, 'butuh E2E_EMAIL dan E2E_PASSWORD')
  await login(page)

  await page.getByRole('radio', { name: 'Bulk' }).click()
  await page.getByRole('button', { name: 'Susu Kurma 250 ml', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Jumlah Susu Kurma 250 ml' }).fill('50')

  // 50 x (15.000 - 1.000) = 700.000, diskon 50.000; bulk tidak kena promo hari apa pun
  await expect(page.getByTestId('cart-discount')).toHaveText(`−${formatRupiah(50000)}`)
  await expect(page.getByTestId('cart-total')).toHaveText(formatRupiah(700000))

  await page.getByRole('button', { name: 'Bayar' }).click()
  await page.getByRole('button', { name: 'Simpan' }).click()
  await expect(page.getByText('Transaksi tersimpan ✓')).toBeVisible()

  const list = page.getByRole('region', { name: 'Transaksi hari ini' })
  await expect(list.getByText(formatRupiah(700000)).first()).toBeVisible()

  await deleteNewestSale(page)
})
