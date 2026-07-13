# Proses Pembuatan Aplikasi JE&DA

Dokumen ini merangkum **cara** aplikasi JE&DA dibangun dari nol sampai siap deploy,
bukan sekadar hasil akhirnya. Ditujukan untuk mengajari sesi/chat lain agar bisa
meniru pola kerjanya. Bahasa Indonesia untuk narasi, istilah teknis apa adanya.

---

## 1. Apa yang dibangun

Aplikasi pencatatan untuk **JE&DA**, usaha jus cold pressed di Pandeglang. Dipakai 2
orang (pemilik & istri) di iPhone dan Android. Menggantikan hitung-hitungan manual
dengan 3 kemampuan inti sesuai prioritas pemilik:

1. **Catat penjualan cepat** di 4 kanal (lapak, CFD, online, bulk).
2. **Tahu stok bahan** dan kapan harus belanja (model produksi batch + resep).
3. **Rekap otomatis** harian/mingguan/bulanan, dengan layar rekap harian yang enak
   di-screenshot.

Titik awalnya bukan langsung koding: ada fase *discovery* (kuesioner ke pemilik) →
`docs/analisis-kuesioner.md`, lalu rencana eksekusi berfase → `docs/IMPLEMENTATION_PLAN.md`,
lalu aturan main untuk AI → `CLAUDE.md`. **Rencana dan konvensi ditulis dulu sebelum
satu baris kode pun dibuat.** Inilah kunci konsistensi.

---

## 2. Stack teknis & alasannya

| Lapisan | Pilihan | Kenapa |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | Cepat, modern, tipe aman. Kode di folder `app/`. |
| Styling | Tailwind CSS 4 | Mobile-first tanpa library UI berat. |
| PWA | vite-plugin-pwa | Installable di HP tanpa app store. |
| State | Zustand | Ringan; hindari Redux. |
| Backend | Supabase (Postgres + Auth + RLS) | Gratis, tanpa perawatan server, database relasional, login jadi. |
| Test unit | Vitest | Untuk logika murni. |
| Test alur | Playwright (WebKit + Chromium) | Meniru iPhone (Safari) & Android (Chrome). |
| Deploy | Vercel (gratis) | Preset Vite otomatis + SPA rewrite. |

**Kenapa Supabase, bukan Firebase/VPS/Sheets?** Dua pengguna dua HP butuh data
bersama di cloud, tanpa orang IT, gratis, dan laporannya relasional (join
resep→bahan→biaya, laba = omzet − HPP − pengeluaran). Postgres+RLS+Auth dalam satu
paket gratis paling pas. Anon key aman diekspos ke browser **selama RLS aktif**.

---

## 3. Cara kerja (metodologi) — bagian terpenting untuk ditiru

### 3.1 Berfase, satu fase per sesi, jangan lompat
Setiap fase punya **kriteria selesai yang bisa diverifikasi**. Tidak menambah fitur
di luar fase yang sedang dikerjakan. Review hasil tiap fase sebelum lanjut. Tiap fase
wajib lolos `npm run build` **dan** `npm run test` sebelum fase berikutnya.

### 3.2 Semua kalkulasi = fungsi murni + unit test
Logika bisnis yang rawan salah diletakkan di fungsi murni (tanpa UI/DB), lalu diuji
terhadap **data hitung tangan**:
- `src/lib/pricing.ts` — mesin harga (promo Jumat/Sabtu, diskon bulk bertingkat).
- `src/lib/hpp.ts` — HPP per botol dari resep (uji: Susu Kurma = Rp7.750).
- `src/lib/shopping.ts` — daftar belanja (kebutuhan − stok).
- `src/lib/reports.ts` — rekap harian/periode, repeat customer rate.
- `src/lib/customerStats.ts` — agregasi pelanggan & umur piutang.

Aturan keras: **komponen UI tidak boleh menghitung apa pun** soal harga/uang.

### 3.3 Perubahan data sensitif lewat fungsi DB (atomik + jejak)
Stok **hanya** berubah lewat fungsi Postgres (`record_sale`, `undo_sale`,
`record_production`, `adjust_ingredient_stock`, `write_off_finished`, `mark_sale_paid`)
yang dipanggil dari `src/lib/stock.ts` via RPC. Semuanya:
- **Atomik** dalam satu transaksi DB (aman dipakai 2 orang bersamaan).
- Tercatat di tabel `stock_movements` (jejak audit).
- `SECURITY INVOKER` + `set search_path = ''` (RLS tetap berlaku; hanya user login).
- Stok kurang **tidak memblokir** transaksi — beri peringatan saja (aturan bisnis).

### 3.4 Uji ke server sungguhan, bukan cuma mock
- Test RLS membuktikan anon **tidak** bisa baca/tulis.
- Test integrasi membuktikan batch produksi benar-benar mengurangi bahan & menambah
  stok jadi lewat `stock_movements`, lalu **mengembalikan DB persis semula**.
- Test ekspor **mengunduh file .xlsx lalu mem-parse-nya kembali** (bukti "terbuka
  benar di Excel").

### 3.5 E2E di dua perangkat
Playwright dikonfigurasi 2 proyek: `iphone` (WebKit) dan `android` (Chromium), worker
tunggal karena berbagi satu database. Alur nyata diuji: login → catat → simpan →
muncul di daftar → hapus. Kredensial akun test lewat env `E2E_EMAIL`/`E2E_PASSWORD`.

### 3.6 Disiplin kebersihan data
E2E membuat data di DB nyata. Setiap test membersihkan miliknya sendiri; sisa
dibersihkan lewat MCP SQL dengan **predikat eksplisit** (mis. hapus `where name in (...)`,
bukan hapus tanpa syarat). Pengaman auto-mode memang memblokir mass-delete tanpa
predikat — itu fitur, bukan penghalang.

### 3.7 Bukti visual tiap fase
Tiap fase diakhiri screenshot layar di emulasi iPhone (390px) sebagai bukti tampilan.

### 3.8 Riset & review adversarial (untuk bagian tak pasti / berisiko)
Sebelum bagian yang rawan salah (PWA, deploy, library, code-splitting), dijalankan
**riset paralel** untuk memastikan praktik terbaik terkini. Sebelum commit fase besar,
dijalankan **review adversarial**: banyak agen mencari bug, lalu tiap temuan
diverifikasi ulang (coba dibantah) sebelum diakui. Ini menangkap bug yang lolos dari
mata satu orang (lihat bagian 6).

---

## 4. Konvensi wajib (dari `CLAUDE.md`)

1. Teks UI **bahasa Indonesia**; kode & nama variabel bahasa Inggris.
2. **Uang selalu integer rupiah** (haram `float`). Tampilan lewat `formatRupiah()`
   (15000 → `Rp15.000`).
3. Kuantitas bahan pakai **satuan terkecil** (gram/ml), integer.
4. **Mobile first** 390px; target ketuk minimal 44px.
5. **Timezone Asia/Jakarta** di semua perhitungan tanggal; batas hari 00.00 WIB.
6. **RLS aktif** di semua tabel; akses hanya untuk user login.
7. Logika harga = fungsi murni di `pricing.ts` + unit test lengkap.
8. Perubahan stok hanya lewat `stock.ts` → `stock_movements`.
9. Tiap fase lolos `build` + `test` sebelum lanjut.

---

## 5. Ringkasan per fase

| Fase | Hasil | Gerbang "selesai" |
|---|---|---|
| **0. Scaffold** | Vite+React+TS+Tailwind+PWA, bottom nav 4 tab, Vitest+Playwright | dev jalan, build bersih, 2 test runner hijau, nav tampil di 390px |
| **1. Data & Auth** | Migrasi 12 tabel + RLS + seed 15 produk, login Supabase, util `formatRupiah`/WIB | login jalan, seed terisi, RLS tolak anon (ada test-nya) |
| **2. Catat Penjualan** | Layar Jual, mesin harga + keranjang Zustand, pembayaran, transaksi hari ini, `record_sale`/`undo_sale` | alur ≤5 ketukan, semua unit test pricing hijau, e2e lapak + bulk 50pcs |
| **3. Produksi & Stok** | Batch produksi, koreksi stok, editor resep + HPP live, daftar belanja WhatsApp, catat sisa | HPP Susu Kurma = 7.750, batch terbukti ubah stok via `stock_movements` |
| **4. Rekap & Laporan** | Kartu rekap harian (screenshot), share PNG, input pengeluaran, rekap mingguan/bulanan, repeat rate | angka cocok hitung tangan, PNG benar, repeat rate benar (skenario 2 pelanggan) |
| **5. Piutang & Pelanggan** | Daftar piutang urut lama + tandai lunas, riwayat pelanggan, badge di tab Lainnya | alur belum-lunas→lunas benar, riwayat akurat |
| **6. PWA, Deploy, Ekspor, Panduan** | Manifest+ikon installable, ekspor Excel, `vercel.json`, panduan pemakaian, code-splitting | app terpasang di HP, ekspor xlsx terbuka benar |
| **7. Uji Lapangan** | (non-koding) seminggu catat dobel aplikasi + buku, bandingkan tiap malam | koreksi terkumpul, baru lepas buku |

---

## 6. Bug nyata yang tertangkap (pelajaran)

Contoh kenapa uji ke server sungguhan + review adversarial itu berharga:

1. **`formatDateWIB` crash di produksi** — fungsi dirancang untuk `YYYY-MM-DD`, tapi
   halaman Piutang/Pelanggan memberinya timestamp ISO lengkap → `RangeError` yang
   mem-blank seluruh halaman. Ditangkap **e2e ke data sungguhan** (bukan unit test),
   diperbaiki agar menerima kedua format, dikunci unit test.
2. **Ekspor terpotong diam-diam di 1000 baris** — Supabase `max_rows=1000`; query
   tanpa paginasi membuang data terbaru tapi lapor "sukses". Ditangkap **review
   adversarial**; diperbaiki dengan paginasi `.range()` penuh.
3. **Tanpa ErrorBoundary** — jika satu chunk lazy gagal permanen (deploy baru + SW
   autoUpdate), seluruh app jadi layar putih buntu untuk pengguna non-teknis.
   Ditangkap review; ditambah ErrorBoundary dengan tombol "Muat ulang".
4. **Fakta terkini via riset** — Vite 8 memakai **Rolldown**, jadi `manualChunks`
   usang → `output.advancedChunks`. Library `write-excel-file` harus di-import dari
   subpath `/browser`. `read-excel-file` mengembalikan seluruh sheet lewat
   `getSheets: true`. Hal-hal ini mudah salah kalau mengandalkan ingatan lama.

Catatan: peringatan advisor Supabase soal policy `USING (true)` **sengaja** diabaikan —
ini workspace bersama 2 akun (semua data milik usaha, bukan per user).

---

## 7. Alat yang dipakai bareng Claude Code

- **MCP Supabase** — menerapkan migrasi (`apply_migration`), menjalankan SQL
  (`execute_sql`), cek advisor keamanan (`get_advisors`) langsung dari sesi.
- **Agent skills Supabase** — panduan best-practice Postgres/RLS.
- **Playwright** — render ikon PNG, screenshot bukti, dan e2e dua perangkat.
- **Workflow (multi-agent)** — riset paralel & review adversarial pada fase berisiko.
- **MCP/plugin Vercel** — deploy & pantau dari sesi (opsional).

Pola prompt per fase (contoh):
```
Baca CLAUDE.md dan docs/IMPLEMENTATION_PLAN.md.
Kerjakan Fase N saja. Jangan mengerjakan fase lain.
Setelah selesai jalankan npm run build dan npm run test,
tunjukkan hasilnya, lalu berhenti.
```

---

## 8. Cara meniru pendekatan ini (ringkas)

1. **Discovery dulu**: pahami kebutuhan nyata (kuesioner), tulis analisisnya.
2. **Tulis rencana berfase + konvensi** sebelum koding (`IMPLEMENTATION_PLAN.md`,
   `CLAUDE.md`). Fase harus punya gerbang yang bisa diverifikasi.
3. **Pisahkan logika dari UI**: semua kalkulasi jadi fungsi murni + unit test dari
   data hitung tangan.
4. **Amankan data**: RLS aktif; perubahan sensitif lewat fungsi DB atomik + jejak.
5. **Uji sungguhan**: unit + integrasi ke DB + e2e dua perangkat; buktikan RLS
   menolak anon.
6. **Jaga kebersihan**: bersihkan data test dengan predikat eksplisit.
7. **Riset sebelum yang tak pasti; review adversarial sebelum commit besar.**
8. **Bukti tiap fase**: build hijau, test hijau, screenshot.

> Inti yang ingin diajarkan: **rencana & konvensi di depan, logika murni yang teruji,
> keamanan sejak awal, dan verifikasi ke sistem nyata** — bukan kecepatan menulis kode.
