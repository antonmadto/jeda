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

/** Format tanggal untuk tampilan, contoh "Sabtu, 11 Juli 2026". */
export function formatDateWIB(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00+07:00`) : date
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}
