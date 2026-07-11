/** Format integer rupiah untuk tampilan, contoh 15000 -> "Rp15.000". */
export function formatRupiah(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error('formatRupiah hanya menerima integer rupiah')
  }
  const sign = amount < 0 ? '-' : ''
  const digits = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}Rp${digits}`
}
