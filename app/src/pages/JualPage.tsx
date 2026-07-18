import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog } from '../lib/catalog'
import type { VariantInfo } from '../lib/catalog'
import { computePrice } from '../lib/pricing'
import type { CartItem } from '../lib/pricing'
import { recordSale } from '../lib/stock'
import type { StockWarning } from '../lib/stock'
import { dayOfWeekWIB } from '../lib/date'
import { useCartStore } from '../store/cart'
import { useReceivablesStore } from '../store/receivables'
import ChannelTabs from '../components/jual/ChannelTabs'
import ProductGrid from '../components/jual/ProductGrid'
import CartBar from '../components/jual/CartBar'
import PaymentSheet from '../components/jual/PaymentSheet'
import type { PaymentChoice } from '../components/jual/PaymentSheet'
import TodaySales from '../components/jual/TodaySales'
import type { TodaySaleRow } from '../components/jual/TodaySales'

export default function JualPage() {
  const [variants, setVariants] = useState<VariantInfo[]>([])
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warnings, setWarnings] = useState<StockWarning[]>([])
  const [savedFlash, setSavedFlash] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const { channel, lines, editingSaleId, setChannel, addOne, setQty, clear, loadForEdit } =
    useCartStore()
  const refreshReceivables = useReceivablesStore((s) => s.refresh)

  useEffect(() => {
    fetchCatalog()
      .then((v) => {
        setVariants(v)
        setLoadStatus('ready')
      })
      .catch(() => setLoadStatus('error'))
  }, [])

  const variantById = useMemo(
    () => Object.fromEntries(variants.map((v) => [v.variantId, v])),
    [variants],
  )
  const qtyByVariant = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.variantId, l.qty])),
    [lines],
  )

  // Harga selalu dihitung mesin harga murni, tidak pernah di komponen.
  const price = useMemo(() => {
    const items: CartItem[] = lines.flatMap((l) => {
      const v = variantById[l.variantId]
      return v ? [{ variantId: l.variantId, category: v.category, price: v.price, qty: l.qty }] : []
    })
    return computePrice(items, channel, new Date())
  }, [lines, channel, variantById])

  async function handleSave(choice: PaymentChoice) {
    setSaving(true)
    try {
      const res = await recordSale({
        channel,
        payment: choice.payment,
        status: choice.status,
        customerId: choice.customerId,
        promoApplied: price.promoApplied,
        subtotal: price.subtotal,
        discount: price.discount,
        total: price.total,
        items: price.items.map((i) => ({
          variantId: i.variantId,
          qty: i.qty,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
        replaceSaleId: editingSaleId,
      })
      setWarnings(res.stockWarnings)
      clear()
      setSheetOpen(false)
      setRefreshKey((k) => k + 1)
      refreshReceivables()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
    } catch {
      window.alert('Gagal menyimpan transaksi. Periksa koneksi lalu coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(sale: TodaySaleRow) {
    loadForEdit(
      sale.id,
      sale.channel,
      sale.sale_items.map((i) => ({ variantId: i.variant_id, qty: i.qty })),
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const dow = dayOfWeekWIB()
  const promoLabel = dow === 5 ? 'Jumat Berkah' : dow === 6 ? 'Sabtu Ceria' : null
  const promoSub =
    dow === 5
      ? 'Fresh juice & creamy jadi Rp15.000'
      : 'Potongan Rp3.000 fresh juice & creamy'
  const promoActive = promoLabel !== null && (channel === 'lapak' || channel === 'cfd')

  if (loadStatus === 'loading') return <p className="text-sm font-medium text-muted">Memuat produk…</p>
  if (loadStatus === 'error')
    return <p className="text-sm font-medium text-danger">Gagal memuat produk. Periksa koneksi.</p>

  return (
    <div className={`flex flex-col gap-4 ${lines.length > 0 ? 'pb-96' : ''}`}>
      <ChannelTabs value={channel} onChange={setChannel} />

      {promoActive && (
        <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-brand bg-brand-light px-3.5 py-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-brand text-[15px] font-extrabold text-white"
          >
            %
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-extrabold text-brand-deep">{promoLabel}</span>
            <span className="text-[12.5px] font-medium text-[#B25578]">{promoSub}</span>
          </span>
        </div>
      )}

      {savedFlash && (
        <p
          role="status"
          className="rounded-2xl bg-money-tint px-3.5 py-3 text-sm font-bold text-money-dark"
        >
          Transaksi tersimpan ✓
        </p>
      )}

      {warnings.length > 0 && (
        <div className="rounded-2xl bg-owe-tint px-3.5 py-3 text-[13.5px] text-owe-deep">
          <p className="font-extrabold text-owe">Stok jadi tidak cukup (tetap tercatat):</p>
          <ul className="list-inside list-disc font-medium">
            {warnings.map((w) => (
              <li key={`${w.name}-${w.size_ml}`}>
                {w.name} {w.size_ml} ml — sisa {w.qty_after}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setWarnings([])}
            className="mt-1 h-11 font-bold text-owe underline"
          >
            Tutup
          </button>
        </div>
      )}

      <ProductGrid variants={variants} qtyByVariant={qtyByVariant} onTap={addOne} />

      <TodaySales
        refreshKey={refreshKey}
        onEdit={handleEdit}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />

      <CartBar
        price={price}
        variantById={variantById}
        editing={editingSaleId !== null}
        onSetQty={setQty}
        onPay={() => setSheetOpen(true)}
        onCancel={clear}
      />

      {sheetOpen && (
        <PaymentSheet
          price={price}
          saving={saving}
          onSave={handleSave}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}
