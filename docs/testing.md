# Testing JE&DA

## Dua tingkat test

1. **Unit test** (`npm run test` di `app/`) — logika murni (harga, HPP, rekap,
   daftar belanja, statistik pelanggan). Tidak menyentuh jaringan.
2. **Test integrasi & e2e** — menyentuh Supabase sungguhan:
   - integrasi (Vitest): RLS, batch produksi, undo produksi, hapus bahan;
   - e2e (Playwright, emulasi iPhone WebKit + Android Chromium): login, jual,
     rekap, piutang, ekspor Excel.

## ⚠️ Jangan jalankan test integrasi/e2e ke database produksi

Sejak aplikasi dipakai sungguhan oleh pemilik, test yang menulis data
(transaksi, pengeluaran, batch) berisiko bercampur dengan data usaha asli.
Gunakan **project Supabase kedua khusus test**.

## Setup project test (sekali saja)

1. Buka [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
   (gratis) → beri nama `jeda-test`.
2. Terapkan semua migrasi di `supabase/migrations/` ke project itu, urut nama file
   (via MCP Supabase yang diarahkan ke project test, atau SQL Editor dashboard —
   copy-paste per file).
3. Buat 1 akun test: **Authentication → Users → Add user** (auto-confirm),
   mis. `e2e@jeda.test`.
4. Matikan pendaftaran publik: **Authentication → Sign In / Providers → Email →
   Allow new users to sign up: OFF**.
5. Catat **Project URL** dan **Publishable key** dari **Settings → API**.

## Menjalankan test ke project test

```bash
cd app
E2E_SUPABASE_URL="https://<ref-test>.supabase.co" \
E2E_SUPABASE_ANON_KEY="sb_publishable_..." \
E2E_EMAIL="e2e@jeda.test" \
E2E_PASSWORD="..." \
npm run test        # unit + integrasi

E2E_SUPABASE_URL="https://<ref-test>.supabase.co" \
E2E_SUPABASE_ANON_KEY="sb_publishable_..." \
E2E_EMAIL="e2e@jeda.test" \
E2E_PASSWORD="..." \
npm run test:e2e    # e2e dua perangkat
```

Cara kerjanya:
- `playwright.config.ts` meneruskan `E2E_SUPABASE_*` ke dev server sebagai
  `VITE_SUPABASE_*` (mengalahkan `.env.local`), dan **tidak** memakai dev server
  yang sudah jalan (yang masih menunjuk produksi).
- Test integrasi Vitest membaca `E2E_SUPABASE_*` lebih dulu, baru fallback ke
  `.env.local`.

Tanpa `E2E_SUPABASE_*`, test integrasi/e2e memakai `.env.local` (produksi) —
hanya untuk keadaan darurat, dan sadari risikonya.

Catatan: test dirancang membersihkan data buatannya sendiri, tapi di project
test hal ini tidak lagi kritis — reset kapan pun aman.
