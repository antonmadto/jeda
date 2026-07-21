import { expect, test } from 'vitest'
import { buildInvestorReport, investorReportFilename } from './investorReport'
import type { BuildInvestorReportInput } from './investorReport'
import {
  computeProfitLoss,
  computeChannelEconomics,
  computeMonthlyTrend,
  computeCashFlow,
} from './finance'
import type { DateRange, FinanceSale, FinanceExpense, FinanceAsset } from './finance'

// HPP resep terkini (fallback): A=10.000, B=7.750.
const hpp = new Map<string, number>([
  ['A', 10000],
  ['B', 7750],
])

const GEN = '2026-04-01T12:00:00+07:00'

// Rentang tiga bulan (Jan..Mar) agar tren > 1 titik.
const Q1: DateRange = { start: '2026-01-01', end: '2026-03-31' }

function sale(
  p: Partial<FinanceSale> & Pick<FinanceSale, 'soldAt' | 'channel' | 'total'>,
): FinanceSale {
  return {
    paidAt: null,
    status: 'lunas',
    discount: 0,
    customerId: null,
    items: [],
    ...p,
  }
}

function fixture(range: DateRange = Q1): BuildInvestorReportInput {
  const sales: FinanceSale[] = [
    // Jan
    sale({
      soldAt: '2026-01-05T10:00:00+07:00',
      channel: 'lapak',
      total: 76000,
      customerId: 'C1',
      items: [{ variantId: 'A', qty: 2, lineTotal: 76000, hppAtSale: 10000 }],
    }),
    // Feb: belum lunas (akrual tetap omzet), lalu dilunasi Mar
    sale({
      soldAt: '2026-02-06T10:00:00+07:00',
      paidAt: '2026-03-02T10:00:00+07:00',
      channel: 'cfd',
      status: 'belum_lunas',
      total: 45000,
      customerId: 'C1',
      items: [{ variantId: 'B', qty: 3, lineTotal: 45000, hppAtSale: 7750 }],
    }),
    // Mar: bulk dengan diskon, hpp null → fallback
    sale({
      soldAt: '2026-03-07T10:00:00+07:00',
      channel: 'bulk',
      total: 15000,
      discount: 3000,
      items: [{ variantId: 'B', qty: 1, lineTotal: 15000, hppAtSale: null }],
    }),
    // belum lunas tanpa paid_at → jadi piutang akhir periode
    sale({
      soldAt: '2026-03-20T10:00:00+07:00',
      channel: 'cfd',
      status: 'belum_lunas',
      total: 30000,
      customerId: 'C2',
      items: [{ variantId: 'A', qty: 1, lineTotal: 30000, hppAtSale: 10000 }],
    }),
    // di luar rentang (Apr) → diabaikan seluruh perhitungan periode
    sale({
      soldAt: '2026-04-03T10:00:00+07:00',
      channel: 'lapak',
      total: 999999,
      items: [{ variantId: 'A', qty: 1, lineTotal: 999999, hppAtSale: 10000 }],
    }),
  ]
  const expenses: FinanceExpense[] = [
    { spentAt: '2026-01-06', category: 'bahan', amount: 100000 }, // opex tidak, kas ya
    { spentAt: '2026-01-20', category: 'gaji', amount: 500000 },
    { spentAt: '2026-02-10', category: 'bensin', amount: 20000 },
    { spentAt: '2026-03-15', category: 'promosi', amount: 5000 },
  ]
  const assets: FinanceAsset[] = [
    { name: 'Mesin Cold Press', purchasedAt: '2026-01-10', cost: 12000000, usefulLifeMonths: 24, isActive: true }, // 500rb/bln
    { name: 'Freezer', purchasedAt: '2026-01-01', cost: 3000000, usefulLifeMonths: null, isActive: true }, // dep 0
    { name: 'Etalase Lama', purchasedAt: '2026-01-01', cost: 9999999, usefulLifeMonths: 12, isActive: false }, // nonaktif
  ]
  const customerHistory = [
    { customerId: 'C1', soldAt: '2025-12-15T10:00:00+07:00' },
    { customerId: 'C1', soldAt: '2026-01-05T10:00:00+07:00' },
    { customerId: 'C1', soldAt: '2026-02-06T10:00:00+07:00' },
    { customerId: 'C2', soldAt: '2026-03-20T10:00:00+07:00' },
  ]
  return { sales, expenses, assets, hppByVariant: hpp, customerHistory, range, generatedAt: GEN }
}

// ---------------------------------------------------------------------------

test('metadata: versi, periode, generatedAt, catatan satuan, profil usaha', () => {
  const r = buildInvestorReport(fixture())
  expect(r.reportVersion).toBe(1)
  expect(r.period).toEqual(Q1)
  expect(r.generatedAt).toBe(GEN)
  expect(r.unitsNote).toContain('integer rupiah')
  expect(r.businessProfile.nama).toBe('JE&DA')
  expect(r.businessProfile.kanal.map((k) => k.key)).toEqual(['lapak', 'cfd', 'online', 'bulk'])
  expect(r.metodologi.length).toBeGreaterThan(0)
  expect(r.disclaimer.toLowerCase()).toContain('bukan laporan')
})

test('angka headline identik dengan output finance.ts untuk input yang sama', () => {
  const inp = fixture()
  const r = buildInvestorReport(inp)

  const pl = computeProfitLoss(inp.sales, inp.expenses, inp.assets, inp.hppByVariant, inp.range)
  const econ = computeChannelEconomics(inp.sales, inp.hppByVariant, inp.range)
  const trend = computeMonthlyTrend(
    inp.sales,
    inp.expenses,
    inp.assets,
    inp.hppByVariant,
    inp.customerHistory,
    inp.range,
  )
  const cf = computeCashFlow(inp.sales, inp.expenses, inp.range)

  // Laba rugi identik apa adanya
  expect(r.labaRugi).toEqual(pl)
  // Ringkasan menurunkan langsung dari finance.ts
  expect(r.ringkasanEksekutif.omzet).toBe(pl.omzet)
  expect(r.ringkasanEksekutif.labaBersih).toBe(pl.labaBersih)
  expect(r.ringkasanEksekutif.kasMasuk).toBe(cf.cashIn)
  expect(r.ringkasanEksekutif.kasKeluar).toBe(cf.cashOut)
  expect(r.ringkasanEksekutif.netCash).toBe(cf.netCash)
  expect(r.ringkasanEksekutif.piutangTotal).toBe(cf.piutang.total)
  // Total transaksi & botol = Σ tren (yang = laba rugi periode)
  expect(r.ringkasanEksekutif.totalTransaksi).toBe(trend.reduce((s, p) => s + p.transaksi, 0))
  expect(r.ringkasanEksekutif.totalBotol).toBe(trend.reduce((s, p) => s + p.botol, 0))

  // Unit economics: sama persis + label kanal ditambahkan
  expect(r.unitEconomics.map(({ channelLabel: _label, ...rest }) => rest)).toEqual(econ)
  expect(r.unitEconomics.find((c) => c.channel === 'lapak')?.channelLabel).toBe('Lapak')

  // Tren & arus kas apa adanya
  expect(r.trenBulanan).toEqual(trend)
  expect(r.arusKas).toEqual(cf)
  expect(r.piutang).toEqual(cf.piutang)

  // Angka konkret hasil hitung tangan
  // omzet = 76.000 + 45.000 + 15.000 + 30.000 = 166.000
  expect(pl.omzet).toBe(166000)
  // margin kotor: COGS = 20.000 + 23.250 + 7.750 + 10.000 = 61.000; labaKotor 105.000
  expect(pl.cogs).toBe(61000)
  expect(r.ringkasanEksekutif.marginKotorPct).toBe(63.3) // 105.000/166.000*100 = 63.25 → 63.3
})

test('aset: total nilai aktif, total semua, depresiasi periode dari laba rugi', () => {
  const inp = fixture()
  const r = buildInvestorReport(inp)
  const pl = computeProfitLoss(inp.sales, inp.expenses, inp.assets, inp.hppByVariant, inp.range)

  // aktif: 12.000.000 + 3.000.000 = 15.000.000 (nonaktif 9.999.999 tidak ikut)
  expect(r.aset.totalNilaiAktif).toBe(15000000)
  expect(r.aset.totalNilaiSemua).toBe(24999999)
  // akumulasi depresiasi periode = depresiasi laba rugi (500rb x 3 bulan = 1.500.000)
  expect(r.aset.akumulasiDepresiasiPeriode).toBe(pl.depresiasi)
  expect(r.aset.akumulasiDepresiasiPeriode).toBe(1500000)
  // per baris: aset ber-masa-manfaat aktif = 500.000/bln, lainnya 0
  expect(r.aset.items.map((a) => a.depresiasiPerBulan)).toEqual([500000, 0, 0])
  // nama aset ikut terbawa ke laporan (untuk tampilan PDF & pratinjau)
  expect(r.aset.items.map((a) => a.name)).toEqual(['Mesin Cold Press', 'Freezer', 'Etalase Lama'])
})

test('serialisasi aman: JSON round-trip deep-equal (tanpa undefined/Date/fungsi)', () => {
  const r = buildInvestorReport(fixture())
  const roundTrip = JSON.parse(JSON.stringify(r))
  expect(roundTrip).toEqual(r)
  // tidak ada nilai undefined tersembunyi (JSON.stringify akan membuangnya)
  expect(JSON.stringify(r)).not.toContain('undefined')
})

test('periode kosong menghasilkan laporan valid bernilai nol', () => {
  const r = buildInvestorReport({
    sales: [],
    expenses: [],
    assets: [],
    hppByVariant: new Map(),
    customerHistory: [],
    range: { start: '2026-01-01', end: '2026-01-31' },
    generatedAt: GEN,
  })
  expect(r.reportVersion).toBe(1)
  expect(r.ringkasanEksekutif).toEqual({
    omzet: 0,
    cogs: 0,
    labaKotor: 0,
    opex: 0,
    depresiasi: 0,
    labaBersih: 0,
    marginKotorPct: 0,
    marginBersihPct: 0,
    totalTransaksi: 0,
    totalBotol: 0,
    kasMasuk: 0,
    kasKeluar: 0,
    netCash: 0,
    piutangTotal: 0,
    totalAsetAktif: 0,
  })
  expect(r.labaRugi.labaBersih).toBe(0)
  expect(r.unitEconomics).toEqual([])
  expect(r.aset.items).toEqual([])
  expect(r.aset.totalNilaiAktif).toBe(0)
  // tetap ada satu titik tren bernilai nol untuk bulan itu
  expect(r.trenBulanan).toHaveLength(1)
  expect(r.trenBulanan[0].omzet).toBe(0)
  // round-trip tetap aman
  expect(JSON.parse(JSON.stringify(r))).toEqual(r)
})

test('nama file mengikuti pola periode', () => {
  const range = { start: '2026-05-01', end: '2026-07-21' }
  expect(investorReportFilename('pdf', range)).toBe('jeda-laporan-investor_2026-05-01_2026-07-21.pdf')
  expect(investorReportFilename('json', range)).toBe(
    'jeda-laporan-investor_2026-05-01_2026-07-21.json',
  )
})
