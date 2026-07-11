import { expect, test } from 'vitest'
import { computePrice } from './pricing'
import type { CartItem } from './pricing'

// Tanggal acuan (WIB): 2026-07-10 Jumat, 2026-07-11 Sabtu, 2026-07-13 Senin
const JUMAT = new Date('2026-07-10T10:00:00+07:00')
const SABTU = new Date('2026-07-11T10:00:00+07:00')
const SENIN = new Date('2026-07-13T10:00:00+07:00')

const fresh500 = (qty: number): CartItem => ({ variantId: 'f500', category: 'fresh', price: 38000, qty })
const fresh250 = (qty: number): CartItem => ({ variantId: 'f250', category: 'fresh', price: 18000, qty })
const creamy = (qty: number): CartItem => ({ variantId: 'c250', category: 'creamy', price: 15000, qty })
const ramu = (qty: number): CartItem => ({ variantId: 'r250', category: 'ramu', price: 15000, qty })

test('harga normal: hari biasa kanal lapak, tanpa promo tanpa diskon', () => {
  const r = computePrice([fresh500(2), creamy(1)], 'lapak', SENIN)
  expect(r.subtotal).toBe(91000)
  expect(r.discount).toBe(0)
  expect(r.total).toBe(91000)
  expect(r.promoApplied).toBeNull()
  expect(r.bulkPerBottle).toBe(0)
})

test('Jumat Berkah: fresh jadi 15.000 di lapak, nama promo tercatat', () => {
  const r = computePrice([fresh500(1), fresh250(2)], 'lapak', JUMAT)
  expect(r.items.find((i) => i.variantId === 'f500')?.unitPrice).toBe(15000)
  expect(r.items.find((i) => i.variantId === 'f250')?.unitPrice).toBe(15000)
  expect(r.total).toBe(45000)
  expect(r.subtotal).toBe(74000)
  expect(r.discount).toBe(29000)
  expect(r.promoApplied).toBe('jumat_berkah')
})

test('Sabtu Ceria: fresh jadi 15.000 di cfd, nama promo sabtu_ceria', () => {
  const r = computePrice([fresh500(1)], 'cfd', SABTU)
  expect(r.total).toBe(15000)
  expect(r.promoApplied).toBe('sabtu_ceria')
})

test('creamy dan ramu tidak kena promo Jumat Berkah', () => {
  const r = computePrice([creamy(2), ramu(1)], 'lapak', JUMAT)
  expect(r.total).toBe(45000)
  expect(r.discount).toBe(0)
  expect(r.promoApplied).toBeNull()
})

test('keranjang campur di hari promo: fresh dipotong, creamy tetap normal', () => {
  const r = computePrice([fresh500(1), creamy(1)], 'cfd', SABTU)
  expect(r.items.find((i) => i.variantId === 'f500')?.unitPrice).toBe(15000)
  expect(r.items.find((i) => i.variantId === 'c250')?.unitPrice).toBe(15000) // harga normalnya memang 15.000
  expect(r.total).toBe(30000)
  expect(r.promoApplied).toBe('sabtu_ceria')
})

test('promo hanya kanal lapak dan cfd: online di hari Jumat tetap normal', () => {
  const r = computePrice([fresh500(1)], 'online', JUMAT)
  expect(r.total).toBe(38000)
  expect(r.promoApplied).toBeNull()
})

test('promo tidak pernah menaikkan harga: fresh di bawah 15.000 tetap', () => {
  const murah: CartItem = { variantId: 'f100', category: 'fresh', price: 10000, qty: 1 }
  const r = computePrice([murah], 'lapak', JUMAT)
  expect(r.total).toBe(10000)
})

test('diskon bulk: 49 botol belum kena, 50 potong 1.000 per botol', () => {
  const r49 = computePrice([creamy(49)], 'bulk', SENIN)
  expect(r49.total).toBe(49 * 15000)
  expect(r49.bulkPerBottle).toBe(0)

  const r50 = computePrice([creamy(50)], 'bulk', SENIN)
  expect(r50.bulkPerBottle).toBe(1000)
  expect(r50.total).toBe(50 * 14000)
  expect(r50.discount).toBe(50000)
})

test('diskon bulk bertingkat: 100 potong 2.000, 500 potong 3.000', () => {
  const r100 = computePrice([creamy(100)], 'bulk', SENIN)
  expect(r100.total).toBe(100 * 13000)

  const r500 = computePrice([creamy(500)], 'bulk', SENIN)
  expect(r500.total).toBe(500 * 12000)
})

test('tingkat diskon bulk dihitung dari total kuantitas semua item', () => {
  const r = computePrice([creamy(30), fresh250(25)], 'bulk', SENIN)
  // total 55 botol -> potong 1.000 per botol untuk semua item
  expect(r.bulkPerBottle).toBe(1000)
  expect(r.total).toBe(30 * 14000 + 25 * 17000)
})

test('diskon bulk hanya kanal bulk: 60 botol di lapak tetap normal', () => {
  const r = computePrice([creamy(60)], 'lapak', SENIN)
  expect(r.total).toBe(60 * 15000)
  expect(r.bulkPerBottle).toBe(0)
})

test('promo dan diskon bulk tidak digabung: kanal bulk di hari Jumat hanya kena diskon bulk', () => {
  const r = computePrice([fresh500(50)], 'bulk', JUMAT)
  expect(r.promoApplied).toBeNull()
  expect(r.bulkPerBottle).toBe(1000)
  expect(r.total).toBe(50 * 37000) // 38.000 - 1.000, bukan 15.000
})

test('item qty 0 diabaikan, keranjang kosong menghasilkan 0', () => {
  const r = computePrice([fresh500(0)], 'lapak', SENIN)
  expect(r.items).toHaveLength(0)
  expect(r.total).toBe(0)
  expect(r.subtotal).toBe(0)
})
