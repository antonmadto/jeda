// Perhitungan HPP (biaya bahan + kemasan per botol) dari resep.
// Fungsi murni, tanpa akses DB/UI.

export type CostLine = {
  /** Kuantitas bahan per 1 botol, satuan terkecil (gram/ml/pcs). */
  qty: number
  /** Biaya per satuan terkecil, boleh pecahan (mis. Rp17,96 per ml). */
  costPerUnit: number
}

/** HPP per botol: tiap baris dibulatkan ke rupiah terdekat, lalu dijumlah. */
export function computeHpp(lines: CostLine[]): number {
  return lines.reduce((sum, l) => sum + Math.round(l.qty * l.costPerUnit), 0)
}

/** Laba kotor per botol dan margin terhadap harga jual. */
export function computeMargin(
  sellPrice: number,
  hpp: number,
): { profit: number; marginPct: number } {
  const profit = sellPrice - hpp
  const marginPct = sellPrice > 0 ? (profit / sellPrice) * 100 : 0
  return { profit, marginPct }
}
