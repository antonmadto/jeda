import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createReadStream } from 'node:fs'
import readXlsxFile from 'read-excel-file/node'

// Butuh kredensial akun test: E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
// Test ini MENULIS data. Hanya jalan ke DB test (E2E_SUPABASE_URL), bukan produksi.
const canWrite =
  Boolean(process.env.E2E_SUPABASE_URL) || process.env.E2E_ALLOW_PROD_WRITES === '1'
const skipReason = 'menulis data: butuh DB test (E2E_SUPABASE_URL) atau E2E_ALLOW_PROD_WRITES=1'

async function login(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Kata sandi').fill(password!)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
}

test('ekspor menghasilkan .xlsx yang bisa dibaca kembali (sheet Penjualan valid)', async ({
  page,
}) => {
  test.skip(!email || !password || !canWrite, skipReason)
  await login(page)

  // 1) Pastikan ada data: buat satu transaksi hari ini
  await page.getByRole('radio', { name: 'Lapak' }).click()
  await page.getByRole('button', { name: 'Immune 500 ml' }).click()
  await page.getByRole('button', { name: 'Bayar' }).click()
  await page.getByRole('button', { name: 'Simpan' }).click()
  await expect(page.getByText('Transaksi tersimpan ✓')).toBeVisible()

  // 2) Ekspor
  await page.goto('/lainnya/ekspor')
  await expect(page.getByRole('heading', { name: 'Ekspor Data' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Unduh Excel' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^jeda-laporan-.*\.xlsx$/)

  // 3) Parse kembali file .xlsx (bukti valid & terbuka benar).
  // getSheets: true mengembalikan seluruh sheet sekaligus: [{ sheet, data }].
  const path = await download.path()
  type Rows = (string | number | null)[][]
  type SheetOut = { sheet: string; data: Rows }
  const allSheets = (await readXlsxFile(createReadStream(path!), {
    getSheets: true,
  })) as unknown as SheetOut[]

  // keempat sheet ada
  expect(allSheets.map((s) => s.sheet)).toEqual(
    expect.arrayContaining(['Penjualan', 'Item Penjualan', 'Pengeluaran', 'Produksi']),
  )

  const penjualan = allSheets.find((s) => s.sheet === 'Penjualan')!.data
  expect(penjualan[0]).toEqual(
    expect.arrayContaining(['Tanggal', 'Kanal', 'Pembayaran', 'Status', 'Total']),
  )
  expect(penjualan.length).toBeGreaterThan(1) // header + minimal 1 transaksi
  // kolom Total berisi angka (uang integer), bukan teks
  const totalIdx = (penjualan[0] as string[]).indexOf('Total')
  expect(typeof penjualan[1][totalIdx]).toBe('number')

  const item = allSheets.find((s) => s.sheet === 'Item Penjualan')!.data
  expect(item[0]).toEqual(expect.arrayContaining(['Produk', 'Jumlah', 'Harga Satuan']))

  // 4) Bersihkan transaksi test (hari ini) dari daftar Jual
  await page.goto('/jual')
  const list = page.getByRole('region', { name: 'Transaksi hari ini' })
  const hapus = list.getByRole('button', { name: 'Hapus' })
  const before = await hapus.count()
  if (before > 0) {
    page.once('dialog', (d) => d.accept())
    await hapus.first().click()
    await expect(hapus).toHaveCount(before - 1, { timeout: 10_000 })
  }
})
