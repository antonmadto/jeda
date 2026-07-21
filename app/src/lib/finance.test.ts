import { expect, test } from 'vitest'
import {
  computeProfitLoss,
  computeChannelEconomics,
  computeMonthlyTrend,
  computeCashFlow,
} from './finance'
import type {
  DateRange,
  FinanceAsset,
  FinanceExpense,
  FinanceSale,
} from './finance'

// HPP resep terkini (fallback): A=10.000, B=7.750 (varian Z tanpa resep = 0).
const hpp = new Map<string, number>([
  ['A', 10000],
  ['B', 7750],
])

const JAN: DateRange = { start: '2026-01-01', end: '2026-01-31' }

// Pembantu ringkas untuk membangun transaksi.
function sale(p: Partial<FinanceSale> & Pick<FinanceSale, 'soldAt' | 'channel' | 'total'>): FinanceSale {
  return {
    paidAt: null,
    status: 'lunas',
    discount: 0,
    customerId: null,
    items: [],
    ...p,
  }
}

// ---------------------------------------------------------------------------
// 1. Laba rugi (akrual)
// ---------------------------------------------------------------------------

test('laba rugi: omzet akrual (semua status), COGS snapshot, opex tanpa bahan/kemasan, depresiasi', () => {
  const sales: FinanceSale[] = [
    // lunas
    sale({ soldAt: '2026-01-05T10:00:00+07:00', channel: 'lapak', total: 76000, items: [{ variantId: 'A', qty: 2, lineTotal: 76000, hppAtSale: 10000 }] }),
    // belum_lunas TETAP diakui sebagai omzet di akrual
    sale({ soldAt: '2026-01-06T10:00:00+07:00', channel: 'cfd', status: 'belum_lunas', total: 45000, customerId: 'C1', items: [{ variantId: 'B', qty: 3, lineTotal: 45000, hppAtSale: 7750 }] }),
    // hpp_at_sale null → fallback biaya resep terkini (B=7.750)
    sale({ soldAt: '2026-01-07T10:00:00+07:00', channel: 'bulk', total: 15000, discount: 3000, items: [{ variantId: 'B', qty: 1, lineTotal: 15000, hppAtSale: null }] }),
    // di luar rentang (Feb) → diabaikan
    sale({ soldAt: '2026-02-03T10:00:00+07:00', channel: 'lapak', total: 999999, items: [{ variantId: 'A', qty: 1, lineTotal: 999999, hppAtSale: 10000 }] }),
  ]
  const expenses: FinanceExpense[] = [
    { spentAt: '2026-01-05', category: 'bensin', amount: 20000 },
    { spentAt: '2026-01-06', category: 'galon', amount: 5000 },
    { spentAt: '2026-01-06', category: 'bahan', amount: 100000 }, // dikecualikan dari opex
    { spentAt: '2026-01-07', category: 'kemasan', amount: 30000 }, // dikecualikan dari opex
    { spentAt: '2026-01-20', category: 'gaji', amount: 500000 },
    { spentAt: '2026-02-01', category: 'gaji', amount: 111111 }, // luar rentang
  ]
  const assets: FinanceAsset[] = [
    { name: 'Aset uji', purchasedAt: '2026-01-10', cost: 12000000, usefulLifeMonths: 24, isActive: true }, // 500.000/bln, Jan termasuk
    { name: 'Aset uji', purchasedAt: '2026-01-01', cost: 3000000, usefulLifeMonths: null, isActive: true }, // tanpa depresiasi → 0
    { name: 'Aset uji', purchasedAt: '2025-01-05', cost: 6000000, usefulLifeMonths: 12, isActive: true }, // habis Des 2025 → 0 di Jan 2026
    { name: 'Aset uji', purchasedAt: '2026-01-01', cost: 9999999, usefulLifeMonths: 12, isActive: false }, // nonaktif → 0
  ]

  const r = computeProfitLoss(sales, expenses, assets, hpp, JAN)
  // omzet = 76.000 + 45.000 + 15.000
  expect(r.omzet).toBe(136000)
  // COGS = 2*10.000 + 3*7.750 + 1*7.750 = 20.000 + 23.250 + 7.750
  expect(r.cogs).toBe(51000)
  expect(r.labaKotor).toBe(85000)
  // opex tanpa bahan/kemasan, urut stabil: bensin, galon, gaji
  expect(r.opexByCategory).toEqual([
    { category: 'bensin', amount: 20000 },
    { category: 'galon', amount: 5000 },
    { category: 'gaji', amount: 500000 },
  ])
  expect(r.opex).toBe(525000)
  // depresiasi Jan hanya aset pertama: round(12.000.000/24) = 500.000
  expect(r.depresiasi).toBe(500000)
  // laba bersih = 85.000 - 525.000 - 500.000
  expect(r.labaBersih).toBe(-940000)
})

test('laba rugi: hpp_at_sale null pada varian tanpa resep = COGS 0', () => {
  const sales: FinanceSale[] = [
    sale({ soldAt: '2026-01-10T10:00:00+07:00', channel: 'lapak', total: 20000, items: [{ variantId: 'Z', qty: 2, lineTotal: 20000, hppAtSale: null }] }),
  ]
  const r = computeProfitLoss(sales, [], [], new Map(), JAN)
  expect(r.cogs).toBe(0)
  expect(r.labaKotor).toBe(20000)
})

test('laba rugi: periode kosong menghasilkan nol, bukan NaN', () => {
  const r = computeProfitLoss([], [], [], hpp, JAN)
  expect(r).toEqual({
    omzet: 0,
    cogs: 0,
    labaKotor: 0,
    opexByCategory: [],
    opex: 0,
    depresiasi: 0,
    labaBersih: 0,
  })
  expect(Number.isNaN(r.labaBersih)).toBe(false)
})

test('laba rugi: batas bulan WIB — transaksi UTC 31 Jan 18:30Z masuk Feb', () => {
  const s = [
    sale({ soldAt: '2026-01-31T18:30:00Z', channel: 'lapak', total: 12345, items: [{ variantId: 'A', qty: 1, lineTotal: 12345, hppAtSale: 10000 }] }),
  ]
  // 18:30Z + 7 jam = 01:30 WIB tanggal 1 Feb → masuk Feb, bukan Jan
  expect(computeProfitLoss(s, [], [], hpp, JAN).omzet).toBe(0)
  expect(computeProfitLoss(s, [], [], hpp, { start: '2026-02-01', end: '2026-02-28' }).omzet).toBe(12345)
})

// ---------------------------------------------------------------------------
// Depresiasi: jendela bulan (awal, akhir, kadaluarsa, nonaktif, null, pembulatan)
// ---------------------------------------------------------------------------

test('depresiasi: jendela bulan + pembulatan + aset dikecualikan', () => {
  const JUN: DateRange = { start: '2026-06-01', end: '2026-06-30' }
  const assets: FinanceAsset[] = [
    // beli Jun (bulan pertama) + pembulatan: round(100.000/3) = 33.333
    { name: 'Aset uji', purchasedAt: '2026-06-01', cost: 100000, usefulLifeMonths: 3, isActive: true },
    // beli Apr, masa 3 bln → Apr,Mei,Jun ; Jun = bulan terakhir: round(300.000/3) = 100.000
    { name: 'Aset uji', purchasedAt: '2026-04-01', cost: 300000, usefulLifeMonths: 3, isActive: true },
    { name: 'Aset uji', purchasedAt: '2026-06-01', cost: 500000, usefulLifeMonths: null, isActive: true }, // null → 0
    { name: 'Aset uji', purchasedAt: '2026-06-01', cost: 900000, usefulLifeMonths: 12, isActive: false }, // nonaktif → 0
    { name: 'Aset uji', purchasedAt: '2026-07-01', cost: 600000, usefulLifeMonths: 6, isActive: true }, // mulai Jul → belum, 0
    { name: 'Aset uji', purchasedAt: '2026-03-01', cost: 600000, usefulLifeMonths: 3, isActive: true }, // Mar,Apr,Mei → habis sebelum Jun, 0
  ]
  const r = computeProfitLoss([], [], assets, hpp, JUN)
  // 33.333 + 100.000
  expect(r.depresiasi).toBe(133333)
  expect(r.labaBersih).toBe(-133333)
})

// ---------------------------------------------------------------------------
// 2. Unit economics per kanal
// ---------------------------------------------------------------------------

test('unit economics per kanal: omzet, botol, COGS, margin, avg harga, share diskon', () => {
  const sales: FinanceSale[] = [
    sale({ soldAt: '2026-01-05T10:00:00+07:00', channel: 'lapak', total: 76000, items: [{ variantId: 'A', qty: 2, lineTotal: 76000, hppAtSale: 10000 }] }),
    sale({ soldAt: '2026-01-06T10:00:00+07:00', channel: 'cfd', total: 45000, items: [{ variantId: 'B', qty: 3, lineTotal: 45000, hppAtSale: 7750 }] }),
    sale({ soldAt: '2026-01-07T10:00:00+07:00', channel: 'bulk', total: 15000, discount: 3000, items: [{ variantId: 'B', qty: 1, lineTotal: 15000, hppAtSale: null }] }),
  ]
  const r = computeChannelEconomics(sales, hpp, JAN)
  // urut CHANNEL_ORDER: lapak, cfd, bulk (online absen)
  expect(r.map((c) => c.channel)).toEqual(['lapak', 'cfd', 'bulk'])

  const lapak = r[0]
  expect(lapak).toEqual({
    channel: 'lapak',
    omzet: 76000,
    bottles: 2,
    cogs: 20000,
    labaKotor: 56000,
    marginPct: 73.7, // 56.000/76.000*100 = 73.684 → 73.7
    avgPricePerBottle: 38000, // 76.000/2
    discount: 0,
    discountSharePct: 0, // 0/3.000
  })
  const cfd = r[1]
  expect(cfd.marginPct).toBe(48.3) // 21.750/45.000*100 = 48.33 → 48.3
  expect(cfd.avgPricePerBottle).toBe(15000)
  const bulk = r[2]
  expect(bulk.cogs).toBe(7750) // fallback map B
  expect(bulk.labaKotor).toBe(7250)
  expect(bulk.discount).toBe(3000)
  expect(bulk.discountSharePct).toBe(100) // 3.000/3.000
})

test('unit economics: guard bagi nol (omzet 0, botol 0, total diskon 0)', () => {
  const sales: FinanceSale[] = [
    sale({ soldAt: '2026-01-05T10:00:00+07:00', channel: 'online', total: 0, items: [{ variantId: 'A', qty: 0, lineTotal: 0, hppAtSale: 10000 }] }),
  ]
  const r = computeChannelEconomics(sales, hpp, JAN)
  expect(r).toEqual([
    {
      channel: 'online',
      omzet: 0,
      bottles: 0,
      cogs: 0,
      labaKotor: 0,
      marginPct: 0,
      avgPricePerBottle: 0,
      discount: 0,
      discountSharePct: 0,
    },
  ])
})

test('unit economics: periode kosong menghasilkan array kosong', () => {
  expect(computeChannelEconomics([], hpp, JAN)).toEqual([])
})

// ---------------------------------------------------------------------------
// 3. Tren bulanan
// ---------------------------------------------------------------------------

test('tren bulanan: omzet/laba/transaksi/botol, growth MoM (guard), repeat rate', () => {
  const RANGE: DateRange = { start: '2026-01-01', end: '2026-04-30' } // Jan..Apr
  const sales: FinanceSale[] = [
    sale({ soldAt: '2026-01-10T10:00:00+07:00', channel: 'lapak', total: 100000, customerId: 'C1', items: [{ variantId: 'A', qty: 10, lineTotal: 100000, hppAtSale: 10000 }] }),
    sale({ soldAt: '2026-02-10T10:00:00+07:00', channel: 'lapak', total: 150000, customerId: 'C1', items: [{ variantId: 'A', qty: 5, lineTotal: 150000, hppAtSale: 5000 }] }),
    // Mar kosong
    sale({ soldAt: '2026-04-05T10:00:00+07:00', channel: 'cfd', total: 50000, customerId: 'C2', items: [{ variantId: 'B', qty: 2, lineTotal: 50000, hppAtSale: 7750 }] }),
  ]
  const expenses: FinanceExpense[] = [
    { spentAt: '2026-01-15', category: 'gaji', amount: 30000 },
    { spentAt: '2026-01-16', category: 'bahan', amount: 999 }, // dikecualikan opex
    { spentAt: '2026-02-15', category: 'bensin', amount: 10000 },
    { spentAt: '2026-04-10', category: 'promosi', amount: 5000 },
  ]
  const assets: FinanceAsset[] = [
    // beli Feb, masa 2 bln → Feb,Mar ; round(1.200.000/2)=600.000
    { name: 'Aset uji', purchasedAt: '2026-02-01', cost: 1200000, usefulLifeMonths: 2, isActive: true },
  ]
  // Riwayat pelanggan lengkap: C1 sudah beli Des 2025 (sebelum periode) → Jan repeat
  const history = [
    { customerId: 'C1', soldAt: '2025-12-15T10:00:00+07:00' },
    { customerId: 'C1', soldAt: '2026-01-10T10:00:00+07:00' },
    { customerId: 'C1', soldAt: '2026-02-10T10:00:00+07:00' },
    { customerId: 'C2', soldAt: '2026-04-05T10:00:00+07:00' },
  ]

  const r = computeMonthlyTrend(sales, expenses, assets, hpp, history, RANGE)
  expect(r.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])

  // Jan: omzet 100.000, cogs 10*10.000=100.000, labaKotor 0, opex 30.000, dep 0 → bersih -30.000
  expect(r[0]).toEqual({
    month: '2026-01', omzet: 100000, labaKotor: 0, labaBersih: -30000,
    transaksi: 1, botol: 10, omzetGrowthPct: null, repeatRate: 1, // C1 sudah beli Des 2025
  })
  // Feb: omzet 150.000, cogs 5*5.000=25.000, labaKotor 125.000, opex 10.000, dep 600.000 → -485.000
  expect(r[1]).toEqual({
    month: '2026-02', omzet: 150000, labaKotor: 125000, labaBersih: -485000,
    transaksi: 1, botol: 5, omzetGrowthPct: 50, repeatRate: 1, // (150-100)/100*100
  })
  // Mar: kosong, dep 600.000 (bulan terakhir jendela) → -600.000, growth (0-150.000)/150.000 = -100
  expect(r[2]).toEqual({
    month: '2026-03', omzet: 0, labaKotor: 0, labaBersih: -600000,
    transaksi: 0, botol: 0, omzetGrowthPct: -100, repeatRate: 0,
  })
  // Apr: omzet 50.000, cogs 2*7.750=15.500, labaKotor 34.500, opex 5.000, dep 0 → 29.500
  // growth: bulan sebelumnya (Mar) omzet 0 → guard bagi nol → null
  // repeat: C2 pertama kali beli Apr → bukan repeat → 0
  expect(r[3]).toEqual({
    month: '2026-04', omzet: 50000, labaKotor: 34500, labaBersih: 29500,
    transaksi: 1, botol: 2, omzetGrowthPct: null, repeatRate: 0,
  })
})

test('tren bulanan: rentang mulai tengah bulan — bulan tepi tidak menelan baris di luar rentang, Σ(tren) = laba rugi', () => {
  // financeData mengambil penjualan tanpa batas bawah (untuk kas/piutang),
  // jadi tren wajib tetap benar meski input memuat baris sebelum rentang.
  const RANGE: DateRange = { start: '2026-04-19', end: '2026-06-30' }
  const sales: FinanceSale[] = [
    // 5 Apr: SEBELUM rentang tapi bulan kalender sama dengan range.start → harus diabaikan
    sale({ soldAt: '2026-04-05T10:00:00+07:00', channel: 'lapak', total: 100000, items: [{ variantId: 'A', qty: 10, lineTotal: 100000, hppAtSale: 10000 }] }),
    // 20 Apr: dalam rentang
    sale({ soldAt: '2026-04-20T10:00:00+07:00', channel: 'lapak', total: 100000, items: [{ variantId: 'A', qty: 4, lineTotal: 100000, hppAtSale: 10000 }] }),
    // 10 Mei: dalam rentang
    sale({ soldAt: '2026-05-10T10:00:00+07:00', channel: 'cfd', total: 60000, items: [{ variantId: 'B', qty: 4, lineTotal: 60000, hppAtSale: 7750 }] }),
  ]
  const expenses: FinanceExpense[] = [
    { spentAt: '2026-04-10', category: 'gaji', amount: 70000 }, // sebelum rentang → diabaikan
    { spentAt: '2026-04-25', category: 'gaji', amount: 30000 }, // dalam rentang (Apr)
  ]

  const r = computeMonthlyTrend(sales, expenses, [], hpp, [], RANGE)
  expect(r.map((p) => p.month)).toEqual(['2026-04', '2026-05', '2026-06'])
  // Apr hanya transaksi 20 Apr: omzet 100.000, cogs 4*10.000=40.000, opex 30.000
  expect(r[0]).toEqual({
    month: '2026-04', omzet: 100000, labaKotor: 60000, labaBersih: 30000,
    transaksi: 1, botol: 4, omzetGrowthPct: null, repeatRate: 0,
  })
  expect(r[1].omzet).toBe(60000)
  expect(r[2].omzet).toBe(0)

  // Rekonsiliasi: Σ(tren) identik dengan laba rugi periode yang sama
  const pl = computeProfitLoss(sales, expenses, [], hpp, RANGE)
  expect(pl.omzet).toBe(160000) // transaksi 5 Apr tidak ikut
  expect(r.reduce((sum, p) => sum + p.omzet, 0)).toBe(pl.omzet)
  expect(r.reduce((sum, p) => sum + p.labaKotor, 0)).toBe(pl.labaKotor)
  expect(r.reduce((sum, p) => sum + p.labaBersih, 0)).toBe(pl.labaBersih)
  expect(r.reduce((sum, p) => sum + p.botol, 0)).toBe(8)
  expect(r.reduce((sum, p) => sum + p.transaksi, 0)).toBe(2)
})

test('tren bulanan: periode kosong tetap menghasilkan titik bernilai nol', () => {
  const r = computeMonthlyTrend([], [], [], hpp, [], { start: '2026-01-01', end: '2026-01-31' })
  expect(r).toEqual([
    { month: '2026-01', omzet: 0, labaKotor: 0, labaBersih: 0, transaksi: 0, botol: 0, omzetGrowthPct: null, repeatRate: 0 },
  ])
})

// ---------------------------------------------------------------------------
// 4. Arus kas + piutang aging
// ---------------------------------------------------------------------------

test('arus kas: kas masuk berbasis paid_at, kas keluar termasuk bahan/kemasan (asimetris)', () => {
  const FEB: DateRange = { start: '2026-02-01', end: '2026-02-28' }
  const item = [{ variantId: 'A', qty: 1, lineTotal: 0, hppAtSale: 5000 }]
  const sales: FinanceSale[] = [
    // terjual Jan, dilunasi Feb → kas masuk Feb (beda dari akrual yang mengakui di Jan)
    sale({ soldAt: '2026-01-20T10:00:00+07:00', paidAt: '2026-02-05T10:00:00+07:00', channel: 'lapak', total: 40000, items: item }),
    // lunas tanpa paid_at → pakai sold_at (transaksi tunai seketika), Feb
    sale({ soldAt: '2026-02-10T10:00:00+07:00', channel: 'lapak', total: 20000, items: item }),
    // belum_lunas tanpa paid_at → belum jadi kas
    sale({ soldAt: '2026-02-15T10:00:00+07:00', status: 'belum_lunas', channel: 'cfd', total: 30000, customerId: 'C9', items: item }),
    // belum_lunas dengan paid_at (dibayar sebagian/terlambat) → kas di paid_at Feb
    sale({ soldAt: '2026-02-12T10:00:00+07:00', paidAt: '2026-02-20T10:00:00+07:00', status: 'belum_lunas', channel: 'cfd', total: 25000, customerId: 'C8', items: item }),
    // lunas terjual & dibayar Jan → kas Jan, di luar Feb
    sale({ soldAt: '2026-01-25T10:00:00+07:00', paidAt: '2026-01-26T10:00:00+07:00', channel: 'lapak', total: 55000, items: item }),
  ]
  const expenses: FinanceExpense[] = [
    { spentAt: '2026-02-03', category: 'bahan', amount: 60000 }, // KAS KELUAR ikut (beda dari opex)
    { spentAt: '2026-02-04', category: 'kemasan', amount: 15000 },
    { spentAt: '2026-02-25', category: 'gaji', amount: 50000 },
    { spentAt: '2026-01-10', category: 'galon', amount: 5000 }, // luar rentang
  ]

  const cf = computeCashFlow(sales, expenses, FEB)
  // kas masuk = 40.000 (CS1 paid Feb) + 20.000 (CS2 sold Feb) + 25.000 (CS4 paid Feb)
  expect(cf.cashIn).toBe(85000)
  // kas keluar = 60.000 + 15.000 + 50.000 (bahan & kemasan ikut)
  expect(cf.cashOut).toBe(125000)
  expect(cf.netCash).toBe(-40000)
  // piutang as-of 28 Feb: hanya CS3 (belum_lunas, tanpa paid_at). CS4 sudah ada paid_at.
  expect(cf.piutang.total).toBe(30000)

  // Bukti akrual ≠ kas: omzet akrual Feb tidak memuat CS1 (terjual Jan)
  const plFeb = computeProfitLoss(sales, [], [], hpp, FEB)
  // 20.000 (CS2) + 30.000 (CS3) + 25.000 (CS4) ; CS1 & CS5 terjual Jan → tidak ada
  expect(plFeb.omzet).toBe(75000)
})

test('arus kas: umur piutang batas bucket (tepat 7 dan tepat 30 hari)', () => {
  const RANGE: DateRange = { start: '2026-01-01', end: '2026-03-01' }
  // as-of = tengah malam 1 Mar WIB. sold_at di tengah malam agar umur bulat.
  const bl = (soldAt: string, total: number, extra: Partial<FinanceSale> = {}): FinanceSale =>
    sale({ soldAt, channel: 'cfd', status: 'belum_lunas', total, customerId: 'C1', ...extra })
  const sales: FinanceSale[] = [
    bl('2026-02-23T00:00:00+07:00', 500), // 6 hari → ≤7
    bl('2026-02-22T00:00:00+07:00', 1000), // tepat 7 hari → ≤7
    bl('2026-01-30T00:00:00+07:00', 2000), // tepat 30 hari → 8..30
    bl('2026-01-29T00:00:00+07:00', 4000), // 31 hari → >30
    // dikecualikan: terjadi setelah akhir periode
    bl('2026-03-05T00:00:00+07:00', 9999),
    // dikecualikan: sudah ada paid_at
    bl('2026-02-01T00:00:00+07:00', 8888, { paidAt: '2026-02-10T10:00:00+07:00' }),
    // dikecualikan: sudah lunas
    sale({ soldAt: '2026-02-01T00:00:00+07:00', channel: 'cfd', total: 7777 }),
  ]
  const cf = computeCashFlow(sales, [], RANGE)
  expect(cf.piutang.bucket0to7).toBe(1500) // 500 + 1000
  expect(cf.piutang.bucket8to30).toBe(2000)
  expect(cf.piutang.bucketOver30).toBe(4000)
  expect(cf.piutang.total).toBe(7500)
})

test('arus kas: periode kosong menghasilkan nol', () => {
  const cf = computeCashFlow([], [], JAN)
  expect(cf).toEqual({
    cashIn: 0,
    cashOut: 0,
    netCash: 0,
    piutang: { total: 0, bucket0to7: 0, bucket8to30: 0, bucketOver30: 0 },
  })
})
