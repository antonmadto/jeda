import { expect, test } from 'vitest'
import { movingAverageCost } from './purchases'

test('rata-rata bergerak normal: stok lama + belanja baru', () => {
  // stok lama 100 @ Rp10 = 1.000 ; belanja 100 seharga 3.000
  // (100*10 + 3000) / (100 + 100) = 4000 / 200 = 20
  expect(movingAverageCost(100, 10, 100, 3000)).toBe(20)
})

test('stok lama <= 0 memakai total_cost / qty (biaya lama diabaikan)', () => {
  // stok 0: biaya lama tak bermakna, pakai 6000 / 300 = 20
  expect(movingAverageCost(0, 999, 300, 6000)).toBe(20)
  // stok negatif diperlakukan sama
  expect(movingAverageCost(-50, 999, 200, 4000)).toBe(20)
})

test('menghasilkan pecahan (tidak dibulatkan), sama seperti kolom cost_per_unit', () => {
  // 167 ml seharga 3.000 dari stok 0 → 17,9640...
  expect(movingAverageCost(0, 0, 167, 3000)).toBeCloseTo(17.9641, 4)
  // campur stok lama pecahan
  // (10*17.96 + 3000) / (10 + 167) = 3179.6 / 177 = 17.9638...
  expect(movingAverageCost(10, 17.96, 167, 3000)).toBeCloseTo(17.9638, 4)
})

test('qty <= 0 dilarang', () => {
  expect(() => movingAverageCost(100, 10, 0, 1000)).toThrow()
  expect(() => movingAverageCost(100, 10, -5, 1000)).toThrow()
})
