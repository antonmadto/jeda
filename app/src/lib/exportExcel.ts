import { downloadBlob } from './download'
import type { Cell } from 'write-excel-file/browser'
import type { ExportColumn, ExportData, ExportRow } from './exportData'

// Pembuatan file .xlsx dengan write-excel-file (build browser, di-import lazy
// agar tidak membebani bundle utama). Uang ditulis sebagai angka + format rupiah
// supaya bisa dijumlah di Excel.

function headerRow(columns: ExportColumn[]): Cell[] {
  return columns.map((c) => ({ value: c.key, type: String, fontWeight: 'bold' }))
}

function dataRow(columns: ExportColumn[], row: ExportRow): Cell[] {
  return columns.map((c): Cell => {
    const v = row[c.key]
    if (c.type === 'text') {
      return v === '' || v == null ? null : { value: String(v), type: String }
    }
    if (typeof v !== 'number') return null
    return c.type === 'money'
      ? { value: v, type: Number, format: '"Rp"#,##0' }
      : { value: v, type: Number }
  })
}

/** Bangun workbook multi-sheet lalu picu unduhan. */
export async function buildAndDownloadXlsx(data: ExportData, filename: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const sheets = data.sheets.map((s) => ({
    sheet: s.name.slice(0, 31), // Excel batasi nama sheet 31 karakter
    stickyRowsCount: 1,
    data: [headerRow(s.columns), ...s.rows.map((r) => dataRow(s.columns, r))],
  }))
  const blob = await writeXlsxFile(sheets).toBlob()
  downloadBlob(blob, filename)
}
