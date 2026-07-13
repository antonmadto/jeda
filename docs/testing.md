# Testing JE&DA

## Konteks penting

Database produksi kini berisi **data usaha sungguhan** (Aiman memakai app tiap
hari), dan tidak ada project Supabase kedua. Karena itu test dibagi dua kelas:

| Kelas | Contoh | Boleh ke produksi? |
|---|---|---|
| **Aman (baca-saja)** | unit test logika murni, RLS anon ditolak, halaman login, katalog tampil, rekap tampil, bagikan PNG, rekap bulanan | ✅ ya |
| **Mutasi (menulis data)** | catat/hapus transaksi, pengeluaran, piutang, batch produksi, ekspor (membuat transaksi) | ❌ **skip otomatis** |

Test mutasi **otomatis di-skip** kecuali diarahkan ke DB test lewat
`E2E_SUPABASE_URL` (atau dipaksa dengan `E2E_ALLOW_PROD_WRITES=1` — darurat saja,
sadari risikonya bercampur dengan data asli).

## Menjalankan test harian (aman, ke produksi)

```bash
cd app
E2E_EMAIL="aiman@jeda.test" E2E_PASSWORD="..." npm run test      # unit + RLS
E2E_EMAIL="aiman@jeda.test" E2E_PASSWORD="..." npm run test:e2e  # e2e baca-saja
```

Test mutasi akan tampil sebagai *skipped* — itu memang disengaja.

## Menjalankan suite penuh (butuh DB test)

Dua pilihan menyediakan DB test:

**A. Supabase lokal (disarankan; butuh instal Docker Desktop / OrbStack sekali):**

```bash
npx supabase start          # dari root repo; unduh image saat pertama kali
npx supabase db reset       # terapkan semua migrasi di supabase/migrations/
npx supabase status         # catat API URL + anon key lokal
```

Buat user test sekali (signup lokal aktif secara default):

```bash
curl -X POST "http://127.0.0.1:54321/auth/v1/signup" \
  -H "apikey: <anon key lokal>" -H "Content-Type: application/json" \
  -d '{"email":"e2e@jeda.test","password":"rahasia-test"}'
```

**B. Project Supabase kedua** (bila suatu saat bisa dibuat): terapkan semua
migrasi, buat user test, matikan signup publik.

Lalu jalankan dengan env menunjuk DB test:

```bash
cd app
E2E_SUPABASE_URL="http://127.0.0.1:54321" \
E2E_SUPABASE_ANON_KEY="<anon key lokal>" \
E2E_EMAIL="e2e@jeda.test" E2E_PASSWORD="rahasia-test" \
npm run test && \
E2E_SUPABASE_URL="http://127.0.0.1:54321" \
E2E_SUPABASE_ANON_KEY="<anon key lokal>" \
E2E_EMAIL="e2e@jeda.test" E2E_PASSWORD="rahasia-test" \
npm run test:e2e
```

Cara kerjanya: `playwright.config.ts` meneruskan `E2E_SUPABASE_*` ke dev server
sebagai `VITE_SUPABASE_*` (mengalahkan `.env.local`) dan menolak memakai dev
server lama yang masih menunjuk produksi; test integrasi Vitest membaca
`E2E_SUPABASE_*` lebih dulu.

## Aturan untuk test baru

1. Test yang menulis data WAJIB memakai guard `canWrite` (lihat spec yang ada).
2. Test mutasi harus membersihkan data buatannya sendiri (untuk DB test pun,
   supaya bisa dijalankan berulang).
3. Jangan pernah mengasumsikan isi data yang bisa diubah pemilik (jumlah bahan
   resep, pengeluaran hari ini, dsb.) — tulis test yang data-driven.
