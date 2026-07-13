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
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center overflow-hidden bg-surface px-6">
      <div
        aria-hidden="true"
        className="absolute -top-[90px] -right-[90px] z-0 h-[240px] w-[240px] rounded-full bg-brand-light"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-[70px] -left-[70px] z-0 h-[190px] w-[190px] rounded-full bg-[#F4E4EA]"
      />
      <div className="relative z-10">
        <div className="mb-7 text-center">
          <img
            src="/logo-pink.png"
            alt="Logo JE&DA"
            className="mx-auto mb-4 h-[88px] w-[88px] rounded-[26px] shadow-[0_8px_24px_rgba(226,81,126,.25)]"
          />
          <h1 className="text-[28px] font-extrabold tracking-[-.02em] text-ink">JE&amp;DA</h1>
          <p className="mt-1 font-medium text-muted">Jus segar, catatan rapi</p>
        </div>
        <div className="rounded-[24px] bg-white p-[22px_20px] shadow-[0_8px_30px_rgba(160,60,95,.12)]">
          <h2 className="mb-4 text-base font-extrabold text-ink">Masuk untuk mulai mencatat</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-ink-2">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-[52px] rounded-[14px] border-[1.5px] border-border-soft bg-white px-3.5 text-base placeholder:text-[#C4B1BA] focus:border-brand focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-ink-2">Kata sandi</span>
              <input
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[52px] rounded-[14px] border-[1.5px] border-border-soft bg-white px-3.5 text-base placeholder:text-[#C4B1BA] focus:border-brand focus:outline-none"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="h-[52px] rounded-2xl bg-brand text-base font-bold text-white shadow-[0_6px_16px_rgba(226,81,126,.28)] active:bg-brand-dark disabled:opacity-60"
            >
              {submitting ? 'Memproses…' : 'Masuk'}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-xs font-semibold text-faint">
          Cold pressed juice · Pandeglang
        </p>
      </div>
    </div>
  )
}
