import { expect, test } from 'vitest'
import {
  computeDailyRecap,
  computePeriodRecap,
  computeRepeatRate,
} from './reports'
import type { ExpenseRecord, SaleRecord, SaleRecordWithDate, VariantMeta } from './reports'

// Meta & HPP: Immune 500ml (P1) HPP 10.000, Susu Kurma 250ml (P2) HPP 7.750
const variantMeta = new Map<string, VariantMeta>([
  ['A', { productId: 'P1', productName: 'Immune', sizeMl: 500 }],
  ['B', { productId: 'P2', productName: 'Susu Kurma', sizeMl: 250 }],
])
const hpp = new Map<string, number>([
  ['A', 10000],
  ['B', 7750],
])

const sales: SaleRecord[] = [
  { channel: 'lapak', payment: 'cash', total: 76000, customerId: null, items: [{ variantId: 'A', qty: 2, lineTotal: 76000 }] },
  { channel: 'cfd', payment: 'qris', total: 45000, customerId: 'C1', items: [{ variantId: 'B', qty: 3, lineTotal: 45000 }] },
  { channel: 'bulk', payment: 'cash', total: 15000, customerId: 'C1', items: [{ variantId: 'B', qty: 1, lineTotal: 15000 }] },
]
const expenses: ExpenseRecord[] = [
  { category: 'bensin', amount: 20000 },
  { category: 'galon', amount: 5000 },
]

test('rekap harian: omzet, botol, kanal, cash/qris cocok hitung tangan', () => {
  const r = computeDailyRecap(sales, expenses, hpp, variantMeta)
  expect(r.omzet).toBe(136000)
  expect(r.bottles).toBe(6)
  expect(r.transactionCount).toBe(3)
  expect(r.cash).toBe(91000)
  expect(r.qris).toBe(45000)

  expect(r.byChannel).toEqual([
    { channel: 'lapak', omzet: 76000, bottles: 2, count: 1 },
    { channel: 'cfd', omzet: 45000, bottles: 3, count: 1 },
    { channel: 'bulk', omzet: 15000, bottles: 1, count: 1 },
  ])
})

test('rekap harian: HPP terjual dan laba kotor', () => {
  const r = computeDailyRecap(sales, expenses, hpp, variantMeta)
  // A: 2x10.000=20.000 ; B: 4x7.750=31.000 ; total 51.000
  expect(r.hppSold).toBe(51000)
  expect(r.totalExpenses).toBe(25000)
  // 136.000 - 51.000 - 25.000
  expect(r.labaKotor).toBe(60000)
})

test('rekap harian: 5 produk terlaris urut jumlah botol', () => {
  const r = computeDailyRecap(sales, expenses, hpp, variantMeta)
  expect(r.topProducts).toEqual([
    { productId: 'P2', productName: 'Susu Kurma', qty: 4, omzet: 60000 },
    { productId: 'P1', productName: 'Immune', qty: 2, omzet: 76000 },
  ])
})

test('varian tanpa resep: HPP 0, laba kotor hanya dikurangi pengeluaran', () => {
  const r = computeDailyRecap(sales, expenses, new Map(), variantMeta)
  expect(r.hppSold).toBe(0)
  expect(r.labaKotor).toBe(136000 - 25000)
})

test('rekap harian kosong menghasilkan nol', () => {
  const r = computeDailyRecap([], [], hpp, variantMeta)
  expect(r.omzet).toBe(0)
  expect(r.labaKotor).toBe(0)
  expect(r.byChannel).toEqual([])
  expect(r.topProducts).toEqual([])
})

test('HPP terjual: utamakan hpp_at_sale (snapshot) di atas biaya resep terkini', () => {
  // hppAtSale beda dari map (A snapshot 9.000 vs map 10.000, B snapshot 8.000 vs 7.750)
  const snapSales: SaleRecord[] = [
    { channel: 'lapak', payment: 'cash', total: 76000, customerId: null, items: [{ variantId: 'A', qty: 2, lineTotal: 76000, hppAtSale: 9000 }] },
    { channel: 'cfd', payment: 'qris', total: 45000, customerId: 'C1', items: [{ variantId: 'B', qty: 3, lineTotal: 45000, hppAtSale: 8000 }] },
  ]
  const r = computeDailyRecap(snapSales, [], hpp, variantMeta)
  // A: 2*9.000=18.000 ; B: 3*8.000=24.000 → 42.000 (bukan 2*10.000 + 3*7.750)
  expect(r.hppSold).toBe(42000)
})

test('HPP terjual: fallback ke biaya resep terkini saat hpp_at_sale null/kosong', () => {
  const mixedSales: SaleRecord[] = [
    // A: snapshot terisi → pakai 9.000
    { channel: 'lapak', payment: 'cash', total: 38000, customerId: null, items: [{ variantId: 'A', qty: 1, lineTotal: 38000, hppAtSale: 9000 }] },
    // B: snapshot null → fallback map 7.750
    { channel: 'cfd', payment: 'cash', total: 15000, customerId: null, items: [{ variantId: 'B', qty: 1, lineTotal: 15000, hppAtSale: null }] },
    // A lagi: snapshot undefined (field hilang) → fallback map 10.000
    { channel: 'lapak', payment: 'cash', total: 38000, customerId: null, items: [{ variantId: 'A', qty: 1, lineTotal: 38000 }] },
  ]
  const r = computeDailyRecap(mixedSales, [], hpp, variantMeta)
  // 9.000 + 7.750 + 10.000
  expect(r.hppSold).toBe(26750)
})

test('HPP terjual: hpp_at_sale null pada varian tanpa resep = 0 (fallback map kosong)', () => {
  const noRecipe: SaleRecord[] = [
    { channel: 'lapak', payment: 'cash', total: 20000, customerId: null, items: [{ variantId: 'Z', qty: 2, lineTotal: 20000, hppAtSale: null }] },
  ]
  const r = computeDailyRecap(noRecipe, [], new Map(), variantMeta)
  expect(r.hppSold).toBe(0)
})

test('rekap periode: tren per hari dengan hari kosong terisi nol', () => {
  const periodSales: SaleRecordWithDate[] = [
    { ...sales[0], dateWIB: '2026-07-09' },
    { ...sales[1], dateWIB: '2026-07-11' },
    { ...sales[2], dateWIB: '2026-07-11' },
  ]
  const dates = ['2026-07-09', '2026-07-10', '2026-07-11']
  const r = computePeriodRecap(periodSales, expenses, hpp, variantMeta, dates)

  expect(r.omzet).toBe(136000)
  expect(r.trend).toEqual([
    { date: '2026-07-09', omzet: 76000, bottles: 2 },
    { date: '2026-07-10', omzet: 0, bottles: 0 },
    { date: '2026-07-11', omzet: 60000, bottles: 4 },
  ])
})

test('repeat rate: 2 pelanggan, C1 punya pembelian sebelumnya', () => {
  // C1 beli Jun20 (sebelum periode), Jul01, Jul05 ; C2 beli Jul03 (baru)
  const history = [
    { customerId: 'C1', soldAt: '2026-06-20T03:00:00Z' },
    { customerId: 'C1', soldAt: '2026-07-01T03:00:00Z' },
    { customerId: 'C2', soldAt: '2026-07-03T03:00:00Z' },
    { customerId: 'C1', soldAt: '2026-07-05T03:00:00Z' },
    { customerId: null, soldAt: '2026-07-04T03:00:00Z' }, // tanpa pelanggan, diabaikan
  ]
  const r = computeRepeatRate(history, '2026-06-30T17:00:00Z', '2026-07-31T17:00:00Z')
  // periode Juli WIB. identified: Jul01, Jul03, Jul05 = 3. repeat: Jul01, Jul05 = 2.
  expect(r.identified).toBe(3)
  expect(r.repeat).toBe(2)
  expect(r.rate).toBeCloseTo(2 / 3, 5)
})

test('repeat rate: semua pelanggan baru menghasilkan 0', () => {
  const history = [
    { customerId: 'C1', soldAt: '2026-07-01T03:00:00Z' },
    { customerId: 'C2', soldAt: '2026-07-03T03:00:00Z' },
  ]
  const r = computeRepeatRate(history, '2026-06-30T17:00:00Z', '2026-07-31T17:00:00Z')
  expect(r).toEqual({ identified: 2, repeat: 0, rate: 0 })
})

test('repeat rate: tanpa transaksi ber-pelanggan menghasilkan 0 aman', () => {
  const r = computeRepeatRate([{ customerId: null, soldAt: '2026-07-01T03:00:00Z' }], '2026-06-30T17:00:00Z', '2026-07-31T17:00:00Z')
  expect(r).toEqual({ identified: 0, repeat: 0, rate: 0 })
})
