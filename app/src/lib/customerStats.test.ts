import { expect, test } from 'vitest'
import { ageInDays, computeCustomerStats } from './customerStats'
import type { SaleForCustomer } from './customerStats'

const sales: SaleForCustomer[] = [
  { customerId: 'C1', total: 50000, status: 'lunas', soldAt: '2026-07-01T03:00:00Z' },
  { customerId: 'C2', total: 20000, status: 'lunas', soldAt: '2026-07-02T03:00:00Z' },
  { customerId: 'C1', total: 30000, status: 'belum_lunas', soldAt: '2026-07-03T03:00:00Z' },
]

test('statistik pelanggan: total belanja, jumlah transaksi, terakhir beli, piutang', () => {
  const stats = computeCustomerStats(sales)
  // urut terakhir beli terbaru dulu: C1 (Jul03) lalu C2 (Jul02)
  expect(stats.map((s) => s.customerId)).toEqual(['C1', 'C2'])

  const c1 = stats.find((s) => s.customerId === 'C1')!
  expect(c1.totalSpent).toBe(80000)
  expect(c1.transactionCount).toBe(2)
  expect(c1.lastPurchaseISO).toBe('2026-07-03T03:00:00Z')
  expect(c1.outstanding).toBe(30000)

  const c2 = stats.find((s) => s.customerId === 'C2')!
  expect(c2.totalSpent).toBe(20000)
  expect(c2.outstanding).toBe(0)
})

test('tanpa transaksi menghasilkan daftar kosong', () => {
  expect(computeCustomerStats([])).toEqual([])
})

test('umur piutang dalam hari penuh', () => {
  expect(ageInDays('2026-07-01T03:00:00Z', '2026-07-11T03:00:00Z')).toBe(10)
  expect(ageInDays('2026-07-11T03:00:00Z', '2026-07-11T09:00:00Z')).toBe(0)
  // waktu masa depan tidak menghasilkan negatif
  expect(ageInDays('2026-07-12T03:00:00Z', '2026-07-11T03:00:00Z')).toBe(0)
})
