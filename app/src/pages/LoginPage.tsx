import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email atau kata sandi salah.')
      setSubmitting(false)
    }
    // saat berhasil, onAuthStateChange di App otomatis membuka aplikasi
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-gray-50 px-6">
      <div className="mb-8 text-center">
        <img
          src="/pwa-192x192.png"
          alt="Logo JE&DA"
          className="mx-auto mb-3 h-20 w-20 rounded-2xl shadow-sm"
        />
        <h1 className="text-2xl font-bold text-gray-900">JE&amp;DA</h1>
        <p className="mt-1 text-gray-600">Masuk untuk mulai mencatat</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-lg border border-gray-300 bg-white px-3 text-base focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Kata sandi</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-lg border border-gray-300 bg-white px-3 text-base focus:border-brand focus:outline-none"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="h-12 rounded-lg bg-brand text-base font-semibold text-white active:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
