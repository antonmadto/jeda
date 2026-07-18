// Logika belanja bahan. Fungsi murni, tanpa akses DB/UI.
// Mencerminkan perhitungan rata-rata bergerak di RPC record_purchase (SQL),
// supaya bisa diuji unit dan dipakai pratinjau di UI tanpa memanggil DB.

/**
 * Biaya per satuan baru setelah belanja, rata-rata bergerak:
 *   (stok_lama * biaya_lama + total_cost) / (stok_lama + qty)
 * Bila stok lama <= 0 (biaya lama tak bermakna), pakai total_cost / qty.
 * Nilai dikembalikan sebagai pecahan (numeric), TIDAK dibulatkan — sama seperti
 * kolom ingredients.cost_per_unit yang boleh pecahan (mis. Rp17,96 per ml).
 */
export function movingAverageCost(
  oldStock: number,
  oldCost: number,
  qty: number,
  totalCost: number,
): number {
  if (qty <= 0) throw new Error('qty harus lebih dari 0')
  if (oldStock > 0) {
    return (oldStock * oldCost + totalCost) / (oldStock + qty)
  }
  return totalCost / qty
}
