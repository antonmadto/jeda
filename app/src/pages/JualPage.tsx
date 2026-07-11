import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog } from '../lib/catalog'
import type { VariantInfo } from '../lib/catalog'
import { computePrice } from '../lib/pricing'
import type { CartItem } from '../lib/pricing'
import { recordSale } from '../lib/stock'
import type { StockWarning } from '../lib/stock'
import { dayOfWeekWIB } from '../lib/date'
import { useCartStore } from '../store/cart'
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
  const promoActive = promoLabel !== null && (channel === 'lapak' || channel === 'cfd')

  if (loadStatus === 'loading') return <p className="text-gray-500">Memuat produk…</p>
  if (loadStatus === 'error')
    return <p className="text-red-600">Gagal memuat produk. Periksa koneksi.</p>

  return (
    <div className={`flex flex-col gap-4 ${lines.length > 0 ? 'pb-96' : ''}`}>
      <ChannelTabs value={channel} onChange={setChannel} />

      {promoActive && (
        <p className="rounded-lg bg-brand-light px-3 py-2 text-sm font-medium text-brand-dark">
          {promoLabel}: semua fresh juice Rp15.000
        </p>
      )}

      {savedFlash && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          Transaksi tersimpan ✓
        </p>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-semibold">Stok jadi tidak cukup (tetap tercatat):</p>
          <ul className="list-inside list-disc">
            {warnings.map((w) => (
              <li key={`${w.name}-${w.size_ml}`}>
                {w.name} {w.size_ml} ml — sisa {w.qty_after}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setWarnings([])}
            className="mt-1 h-11 font-semibold text-amber-700 underline"
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
