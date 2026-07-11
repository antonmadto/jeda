# CLAUDE.md

Panduan untuk Claude Code saat mengerjakan repo ini.

## Konteks Proyek

Aplikasi pencatatan untuk JE&DA, usaha jus cold pressed di Pandeglang. Pemilik bernama Aiman, pengguna aplikasi 2 orang (Aiman dan istri). Kebutuhan lengkap ada di `docs/analisis-kuesioner.md`. Rencana eksekusi berfase ada di `docs/IMPLEMENTATION_PLAN.md`. Kerjakan fase sesuai urutan, jangan lompat.

## Stack

1. Frontend React 19 + Vite + TypeScript, Tailwind CSS 4, PWA via vite-plugin-pwa. Kode app di folder `app/`.
2. Backend Supabase (Postgres, Auth, Row Level Security). Paket gratis.
3. State ringan pakai Zustand. Jangan pakai Redux.
4. Test unit pakai Vitest, test alur pakai Playwright.
5. Deploy Vercel atau Netlify, keduanya paket gratis.

## Perintah

```bash
npm run dev          # jalankan lokal
npm run build        # build produksi
npm run test         # vitest
npm run test:e2e     # playwright
npx supabase db push # terapkan migrasi (butuh supabase cli login)
```

## Konvensi Wajib

1. Semua teks UI berbahasa Indonesia. Kode dan nama variabel berbahasa Inggris.
2. Uang selalu integer rupiah. Dilarang float untuk uang. Format tampilan pakai util `formatRupiah()`, contoh 15000 tampil sebagai Rp15.000.
3. Kuantitas bahan pakai satuan terkecil, gram dan mililiter, integer.
4. Mobile first. Semua layar dirancang untuk lebar 390 px dulu. Target ketuk minimal 44 px.
5. Timezone Asia/Jakarta di semua perhitungan tanggal. Batas hari operasional jam 00.00 WIB.
6. Semua tabel Supabase wajib RLS aktif, akses hanya untuk user yang login.
7. Logika harga (promo, diskon bulk) harus fungsi murni di `src/lib/pricing.ts` dengan unit test lengkap. Tidak boleh ada perhitungan harga di komponen UI.
8. Perubahan stok hanya lewat fungsi di `src/lib/stock.ts`, tercatat di tabel `stock_movements`. Tidak boleh update kolom stok langsung dari UI.
9. Setiap fase selesai harus lolos `npm run build` dan `npm run test` sebelum lanjut fase berikutnya.

## Istilah Domain

| Istilah | Arti |
|---|---|
| Kanal | Tempat penjualan. `lapak` (Toko Dirgantara), `cfd` (CFD Pandeglang, Minggu), `online` (order harian), `bulk` (pre order besar) |
| Batch produksi | Pembuatan jus dini hari, jam 3 sd 5 pagi, mengurangi stok bahan dan menambah stok jadi |
| Stok jadi | Botol siap jual di freezer, umur simpan 3 sd 5 hari |
| HPP | Biaya bahan plus kemasan per botol, dihitung dari resep |
| Jumat Berkah / Sabtu Ceria | Promo, semua fresh juice jadi 15.000 pada hari Jumat dan Sabtu |
| Diskon bulk | 50 pcs potong 1.000 per botol, 100 pcs potong 2.000, 500 pcs potong 3.000 |
| Rekap harian | Layar ringkasan satu hari yang di-screenshot pemilik tiap malam sebagai bukti |

## Aturan Bisnis Penting

1. Promo Jumat Berkah dan Sabtu Ceria hanya berlaku kategori fresh juice, bukan creamy atau ramu, hanya di kanal lapak dan cfd.
2. Diskon bulk hanya kanal bulk, dihitung per botol berdasarkan total kuantitas pesanan.
3. Promo dan diskon bulk tidak digabung.
4. Penjualan boleh ditandai `belum_lunas` untuk pelanggan dekat, masuk daftar piutang.
5. Penjualan mengurangi stok jadi. Kalau stok jadi tidak cukup, tetap boleh dicatat tapi beri tanda peringatan, jangan blokir transaksi.

## Yang Tidak Boleh Dilakukan

1. Jangan menambah fitur di luar fase yang sedang dikerjakan.
2. Jangan pakai library UI berat (MUI, Ant). Cukup Tailwind dan komponen sendiri.
3. Jangan simpan secret di kode. Env vars di `.env.local`, contoh di `.env.example`.
4. Jangan hapus atau ubah file di `cetak/` dan `kuesioner-jeda.html`, itu arsip fase discovery.
