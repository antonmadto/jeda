const WIB = 'Asia/Jakarta'

/** Tanggal hari operasional (batas jam 00.00 WIB) dalam format YYYY-MM-DD. */
export function todayWIB(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** Hari dalam minggu menurut WIB: 0 = Minggu ... 6 = Sabtu. */
export function dayOfWeekWIB(now: Date = new Date()): number {
  const name = new Intl.DateTimeFormat('id-ID', { timeZone: WIB, weekday: 'long' }).format(now)
  return WEEKDAYS.indexOf(name)
}

/** Awal hari operasional hari ini (00.00 WIB) sebagai Date. */
export function startOfTodayWIB(now: Date = new Date()): Date {
  return new Date(`${todayWIB(now)}T00:00:00+07:00`)
}

/** Awal suatu tanggal (00.00 WIB) sebagai Date. */
export function startOfDayWIB(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+07:00`)
}

/** Tambah/kurang hari pada tanggal kalender YYYY-MM-DD (tanpa efek zona waktu). */
export function addDaysWIB(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Daftar tanggal YYYY-MM-DD dari start sampai endInclusive. */
export function dateRangeWIB(startStr: string, endInclusive: string): string[] {
  const out: string[] = []
  let cur = startStr
  while (cur <= endInclusive) {
    out.push(cur)
    cur = addDaysWIB(cur, 1)
  }
  return out
}

/** Batas bulan kalender dari suatu tanggal: { start (1 bln), end (1 bln berikutnya, eksklusif) }. */
export function monthBoundsWIB(dateStr: string): { start: string; end: string } {
  const [y, m] = dateStr.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`
  return { start, end }
}

/** Format tanggal pendek untuk sumbu tren, contoh "11 Jul". */
export function formatShortDateWIB(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    day: 'numeric',
    month: 'short',
  }).format(startOfDayWIB(dateStr))
}

/** Format jam untuk tampilan menurut WIB, contoh "07.30". */
export function formatTimeWIB(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Format tanggal untuk tampilan, contoh "Sabtu, 11 Juli 2026".
 * Menerima tanggal ("YYYY-MM-DD", dianggap WIB) maupun timestamp ISO lengkap.
 */
export function formatDateWIB(date: Date | string): string {
  const d =
    typeof date === 'string'
      ? new Date(date.includes('T') ? date : `${date}T00:00:00+07:00`)
      : date
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}
