import { expect, test } from 'vitest'
import { dayOfWeekWIB, formatDateWIB, todayWIB } from './date'

test('todayWIB memakai batas hari 00.00 WIB, bukan UTC', () => {
  // 17.30 UTC = 00.30 WIB hari berikutnya
  expect(todayWIB(new Date('2026-07-10T17:30:00Z'))).toBe('2026-07-11')
  // 16.30 UTC = 23.30 WIB hari yang sama
  expect(todayWIB(new Date('2026-07-10T16:30:00Z'))).toBe('2026-07-10')
})

test('dayOfWeekWIB mengembalikan 0=Minggu sampai 6=Sabtu menurut WIB', () => {
  // 2026-07-11 adalah Sabtu; jam 01.00 WIB = 2026-07-10 18.00 UTC (Jumat di UTC)
  expect(dayOfWeekWIB(new Date('2026-07-10T18:00:00Z'))).toBe(6)
  // 2026-07-12 adalah Minggu
  expect(dayOfWeekWIB(new Date('2026-07-12T03:00:00Z'))).toBe(0)
  // 2026-07-10 adalah Jumat
  expect(dayOfWeekWIB(new Date('2026-07-10T03:00:00Z'))).toBe(5)
})

test('formatDateWIB menampilkan tanggal berbahasa Indonesia', () => {
  expect(formatDateWIB('2026-07-11')).toBe('Sabtu, 11 Juli 2026')
})
