import { expect, test } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { buildInvestorReport } from './investorReport'
import type { FinanceSale } from './finance'

// Smoke: render dokumen PDF ke buffer untuk memastikan komponen & style valid
// dan tidak ada glyph yang menggagalkan Helvetica bawaan. (File sementara.)
test('render PDF ke buffer tidak error', async () => {
  const sales: FinanceSale[] = [
    {
      soldAt: '2026-01-05T10:00:00+07:00',
      paidAt: null,
      channel: 'lapak',
      status: 'lunas',
      total: 76000,
      discount: 0,
      customerId: 'C1',
      items: [{ variantId: 'A', qty: 2, lineTotal: 76000, hppAtSale: 10000 }],
    },
    {
      soldAt: '2026-02-20T10:00:00+07:00',
      paidAt: null,
      channel: 'cfd',
      status: 'belum_lunas',
      total: 30000,
      discount: 0,
      customerId: 'C2',
      items: [{ variantId: 'A', qty: 1, lineTotal: 30000, hppAtSale: 10000 }],
    },
  ]
  const report = buildInvestorReport({
    sales,
    expenses: [{ spentAt: '2026-01-20', category: 'gaji', amount: 500000 }],
    assets: [
      {
        name: 'Mesin Cold Press',
        purchasedAt: '2026-01-10',
        cost: 12000000,
        usefulLifeMonths: 24,
        isActive: true,
      },
    ],
    hppByVariant: new Map([['A', 10000]]),
    customerHistory: [{ customerId: 'C1', soldAt: '2025-12-01T10:00:00+07:00' }],
    range: { start: '2026-01-01', end: '2026-03-31' },
    generatedAt: '2026-04-01T12:00:00+07:00',
  })

  const { InvestorReportDocumentForTest } = await import('./investorReportPdf')
  const buf = await renderToBuffer(<InvestorReportDocumentForTest report={report} />)
  // header %PDF-
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  expect(buf.length).toBeGreaterThan(1000)
}, 30_000)
