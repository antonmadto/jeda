import type { VariantInfo } from '../../lib/catalog'
import type { PriceResult } from '../../lib/pricing'
import { formatRupiah } from '../../lib/format'

const PROMO_LABELS: Record<string, string> = {
  jumat_berkah: 'Jumat Berkah',
  sabtu_ceria: 'Sabtu Ceria',
}

export default function CartBar({
  price,
  variantById,
  editing,
  onSetQty,
  onPay,
  onCancel,
}: {
  price: PriceResult
  variantById: Record<string, VariantInfo>
  editing: boolean
  onSetQty: (variantId: string, qty: number) => void
  onPay: () => void
  onCancel: () => void
}) {
  if (price.items.length === 0) return null
  const bottleCount = price.items.reduce((sum, i) => sum + i.qty, 0)

  return (
    <div className="fixed inset-x-2.5 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+10px)] z-20 mx-auto max-w-md rounded-[22px] bg-white px-4 pt-3 pb-3.5 shadow-[0_-2px_30px_rgba(160,60,95,.18)]">
      {editing && (
        <p className="mb-1.5 rounded-[10px] bg-owe-tint px-2.5 py-1.5 text-xs font-bold text-owe">
          Mode koreksi — transaksi lama diganti saat disimpan
        </p>
      )}
      <ul className="max-h-40 divide-y divide-line overflow-y-auto">
        {price.items.map((item) => {
          const v = variantById[item.variantId]
          return (
            <li key={item.variantId} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-ink">{v?.label ?? '—'}</p>
                <p className="text-xs font-medium text-muted">
                  {formatRupiah(item.unitPrice)}
                  {v && item.unitPrice !== v.price && (
                    <span className="ml-1 text-faint line-through">{formatRupiah(v.price)}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Kurangi ${v?.label ?? ''}`}
                  onClick={() => onSetQty(item.variantId, item.qty - 1)}
                  className="h-[42px] w-[42px] rounded-[12px] bg-tint text-lg font-bold text-tint-ink active:bg-tint-dark"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`Jumlah ${v?.label ?? ''}`}
                  value={item.qty}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    // field kosong saat mengetik ulang: pertahankan item, jangan hapus
                    onSetQty(item.variantId, Number.isNaN(n) ? 1 : n)
                  }}
                  className="h-[42px] w-[52px] rounded-[12px] border-[1.5px] border-border-soft text-center text-[15px] font-extrabold text-ink"
                />
                <button
                  type="button"
                  aria-label={`Tambah ${v?.label ?? ''}`}
                  onClick={() => onSetQty(item.variantId, item.qty + 1)}
                  className="h-[42px] w-[42px] rounded-[12px] bg-brand-light text-lg font-bold text-brand active:bg-[#F9DCE7]"
                >
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-1.5 flex flex-col gap-0.5 text-sm">
        {price.discount > 0 && (
          <>
            <div className="flex justify-between font-medium text-muted">
              <span>Subtotal</span>
              <span>{formatRupiah(price.subtotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-money-dark">
              <span>
                {price.promoApplied
                  ? `Promo ${PROMO_LABELS[price.promoApplied]}`
                  : price.bulkPerBottle > 0
                    ? `Diskon bulk ${formatRupiah(price.bulkPerBottle)}/botol`
                    : 'Diskon'}
              </span>
              <span data-testid="cart-discount">−{formatRupiah(price.discount)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[14.5px] font-extrabold text-ink">
            {bottleCount} botol · <span data-testid="cart-total">{formatRupiah(price.total)}</span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-[46px] rounded-[14px] bg-tint px-3 text-sm font-bold text-tint-ink active:bg-tint-dark"
            >
              {editing ? 'Batal koreksi' : 'Kosongkan'}
            </button>
            <button
              type="button"
              onClick={onPay}
              className="h-[46px] rounded-[14px] bg-brand px-5 text-sm font-extrabold text-white shadow-[0_6px_16px_rgba(226,81,126,.28)] active:bg-brand-dark"
            >
              Bayar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
