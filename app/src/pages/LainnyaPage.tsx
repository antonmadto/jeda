import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LainnyaPage() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null)
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-gray-900">Lainnya</h2>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">Masuk sebagai</p>
        <p className="font-medium text-gray-900">{email ?? '—'}</p>
      </div>
      <p className="text-gray-600">Piutang, pelanggan, dan pengaturan akan dibuat di fase berikutnya.</p>
      <button
        type="button"
        onClick={handleLogout}
        className="h-12 rounded-lg border border-gray-300 bg-white font-semibold text-gray-700 active:bg-gray-100"
      >
        Keluar
      </button>
    </section>
  )
}
