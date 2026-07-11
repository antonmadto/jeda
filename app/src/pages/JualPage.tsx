import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRupiah } from '../lib/format'

// Layar sementara Fase 1: menampilkan katalog dari database.
// Di Fase 2 layar ini menjadi layar pencatatan penjualan.

type ProductRow = {
  id: string
  name: string
  category: 'fresh' | 'creamy' | 'ramu'
  product_variants: { id: string; size_ml: number; price: number }[]
}

const CATEGORY_LABELS: Record<ProductRow['category'], string> = {
  fresh: 'Fresh Juice',
  creamy: 'Creamy',
  ramu: 'Ramu',
}

export default function JualPage() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, category, product_variants (id, size_ml, price)')
      .eq('is_active', true)
      .order('category')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          setStatus('error')
        } else {
          setProducts((data ?? []) as ProductRow[])
          setStatus('ready')
        }
      })
  }, [])

  if (status === 'loading') return <p className="text-gray-500">Memuat produk…</p>
  if (status === 'error') return <p className="text-red-600">Gagal memuat produk. Periksa koneksi.</p>

  const categories = (['fresh', 'creamy', 'ramu'] as const).filter((c) =>
    products.some((p) => p.category === c),
  )

  return (
    <section className="flex flex-col gap-6">
      {categories.map((category) => (
        <div key={category}>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            {CATEGORY_LABELS[category]}
          </h2>
          <ul className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm">
            {products
              .filter((p) => p.category === category)
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="text-right text-sm text-gray-600">
                    {[...p.product_variants]
                      .sort((a, b) => b.size_ml - a.size_ml)
                      .map((v) => `${v.size_ml} ml ${formatRupiah(v.price)}`)
                      .join(' · ')}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
