import { dayOfWeekWIB } from './date'

// Mesin harga JE&DA. Fungsi murni, tanpa akses DB/UI.
// Aturan (update pemilik, 18 Jul 2026):
// 1. Jumat Berkah: semua varian fresh juice & creamy jadi 15.000/botol.
//    Sabtu Ceria: potongan 3.000/botol untuk fresh juice & creamy.
//    Keduanya hanya kanal lapak & cfd; ramu tidak ikut promo.
// 2. Diskon bulk hanya kanal bulk, per botol berdasar total kuantitas pesanan.
// 3. Promo dan diskon bulk tidak pernah digabung (kanal bulk tidak kena promo).

export const PROMO_PRICE = 15000 // Jumat Berkah: harga flat per botol
export const SABTU_DISCOUNT = 3000 // Sabtu Ceria: potongan per botol

export const BULK_TIERS = [
  { minQty: 500, perBottle: 3000 },
  { minQty: 100, perBottle: 2000 },
  { minQty: 50, perBottle: 1000 },
] as const

export type Channel = 'lapak' | 'cfd' | 'online' | 'bulk'
export type Category = 'fresh' | 'creamy' | 'ramu'
export type PromoName = 'jumat_berkah' | 'sabtu_ceria'

export const PROMO_LABELS: Record<PromoName, string> = {
  jumat_berkah: 'Jumat Berkah',
  sabtu_ceria: 'Sabtu Ceria',
}

export type CartItem = {
  variantId: string
  category: Category
  price: number // harga normal per botol, integer rupiah
  qty: number
}

export type PricedItem = {
  variantId: string
  qty: number
  unitPrice: number // harga per botol setelah promo/diskon
  lineTotal: number
}

export type PriceResult = {
  items: PricedItem[]
  subtotal: number // total harga normal
  discount: number // subtotal - total (promo/bulk + diskon manual)
  promoBulkDiscount: number // bagian diskon dari promo/bulk saja
  manualDiscount: number // diskon manual yang benar-benar terpakai (sudah di-clamp)
  total: number
  promoApplied: PromoName | null
  bulkPerBottle: number // potongan per botol untuk kanal bulk (0 kalau tidak kena)
}

export function computePrice(
  items: CartItem[],
  channel: Channel,
  date: Date,
  /** Diskon manual per transaksi (integer rupiah), diisi kasir. */
  customDiscount = 0,
): PriceResult {
  const active = items.filter((i) => i.qty > 0)
  const subtotal = active.reduce((sum, i) => sum + i.price * i.qty, 0)

  const dow = dayOfWeekWIB(date)
  const promoName: PromoName | null =
    dow === 5 ? 'jumat_berkah' : dow === 6 ? 'sabtu_ceria' : null
  const promoEligible = promoName !== null && (channel === 'lapak' || channel === 'cfd')

  let bulkPerBottle = 0
  if (channel === 'bulk') {
    const totalQty = active.reduce((sum, i) => sum + i.qty, 0)
    bulkPerBottle = BULK_TIERS.find((t) => totalQty >= t.minQty)?.perBottle ?? 0
  }

  let promoApplied: PromoName | null = null
  const priced: PricedItem[] = active.map((i) => {
    let unitPrice = i.price
    const promoCategory = i.category === 'fresh' || i.category === 'creamy'
    if (promoEligible && promoCategory) {
      if (promoName === 'jumat_berkah') {
        // harga flat; promo tidak pernah menaikkan harga
        unitPrice = Math.min(PROMO_PRICE, i.price)
      } else {
        // sabtu_ceria: potongan per botol
        unitPrice = Math.max(0, i.price - SABTU_DISCOUNT)
      }
      promoApplied = promoName
    } else if (bulkPerBottle > 0) {
      unitPrice = Math.max(0, i.price - bulkPerBottle)
    }
    return { variantId: i.variantId, qty: i.qty, unitPrice, lineTotal: unitPrice * i.qty }
  })

  const itemsTotal = priced.reduce((sum, i) => sum + i.lineTotal, 0)
  // diskon manual: integer, tidak negatif, tidak melebihi total setelah promo/bulk
  const manualDiscount = Math.min(Math.max(0, Math.floor(customDiscount)), itemsTotal)
  const total = itemsTotal - manualDiscount

  return {
    items: priced,
    subtotal,
    discount: subtotal - total,
    promoBulkDiscount: subtotal - itemsTotal,
    manualDiscount,
    total,
    promoApplied,
    bulkPerBottle,
  }
}
