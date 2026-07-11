// Agregasi statistik pelanggan dan umur piutang. Fungsi murni, teruji.

export type SaleForCustomer = {
  customerId: string
  total: number
  status: 'lunas' | 'belum_lunas'
  soldAt: string
}

export type CustomerStat = {
  customerId: string
  totalSpent: number // semua transaksi (lunas + belum lunas)
  transactionCount: number
  lastPurchaseISO: string
  outstanding: number // total yang masih belum lunas
}

/** Statistik per pelanggan, urut dari yang terakhir beli paling baru. */
export function computeCustomerStats(sales: SaleForCustomer[]): CustomerStat[] {
  const byCustomer = new Map<string, CustomerStat>()
  for (const s of sales) {
    const stat =
      byCustomer.get(s.customerId) ??
      {
        customerId: s.customerId,
        totalSpent: 0,
        transactionCount: 0,
        lastPurchaseISO: s.soldAt,
        outstanding: 0,
      }
    stat.totalSpent += s.total
    stat.transactionCount += 1
    if (s.soldAt > stat.lastPurchaseISO) stat.lastPurchaseISO = s.soldAt
    if (s.status === 'belum_lunas') stat.outstanding += s.total
    byCustomer.set(s.customerId, stat)
  }
  return [...byCustomer.values()].sort((a, b) =>
    a.lastPurchaseISO < b.lastPurchaseISO ? 1 : a.lastPurchaseISO > b.lastPurchaseISO ? -1 : 0,
  )
}

/** Umur piutang dalam hari penuh (tidak pernah negatif). */
export function ageInDays(fromISO: string, nowISO: string): number {
  const ms = new Date(nowISO).getTime() - new Date(fromISO).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}
