import { expect, test } from 'vitest'
import { computeHpp, computeMargin } from './hpp'

test('HPP Susu Kurma 250 ml menghasilkan 7.750 (validasi kuesioner)', () => {
  // susu 167 ml = 3.000, kurma 42 g = 2.500, air galon 500 ml = 1.050, botol+stiker = 1.200
  const hpp = computeHpp([
    { qty: 167, costPerUnit: 17.9641 },
    { qty: 42, costPerUnit: 59.5238 },
    { qty: 500, costPerUnit: 2.1 },
    { qty: 1, costPerUnit: 1200 },
  ])
  expect(hpp).toBe(7750)
})

test('tiap baris dibulatkan ke rupiah terdekat sebelum dijumlah', () => {
  expect(computeHpp([{ qty: 167, costPerUnit: 17.9641 }])).toBe(3000)
  expect(computeHpp([{ qty: 42, costPerUnit: 59.5238 }])).toBe(2500)
})

test('resep kosong menghasilkan HPP 0', () => {
  expect(computeHpp([])).toBe(0)
})

test('margin Susu Kurma: jual 15.000, HPP 7.750, laba 7.250', () => {
  const { profit, marginPct } = computeMargin(15000, 7750)
  expect(profit).toBe(7250)
  expect(marginPct).toBeCloseTo(48.33, 1)
})

test('margin aman saat harga jual 0', () => {
  expect(computeMargin(0, 5000)).toEqual({ profit: -5000, marginPct: 0 })
})
