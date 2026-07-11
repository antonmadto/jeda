import { expect, test } from 'vitest'
import { formatRupiah } from './format'

test('formatRupiah memformat integer rupiah dengan pemisah titik', () => {
  expect(formatRupiah(0)).toBe('Rp0')
  expect(formatRupiah(500)).toBe('Rp500')
  expect(formatRupiah(7750)).toBe('Rp7.750')
  expect(formatRupiah(15000)).toBe('Rp15.000')
  expect(formatRupiah(38000)).toBe('Rp38.000')
  expect(formatRupiah(1000000)).toBe('Rp1.000.000')
})

test('formatRupiah menangani nilai negatif', () => {
  expect(formatRupiah(-2500)).toBe('-Rp2.500')
})

test('formatRupiah menolak non-integer', () => {
  expect(() => formatRupiah(15000.5)).toThrow()
})
