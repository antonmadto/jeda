# Rencana Pengembangan Aplikasi Usaha Jus JE&DA

Disusun 11 Juli 2026. Konteks dari foto lapak. Merek JE&DA, jus tanpa gula tanpa pengawet, kemasan botol dan cup, contoh produk Semangka Lemon serta Kurma Susu Rp15.000 per 250 ml, jam buka 09.00 sd 17.00, lokasi depan Toko Dirgantara, sudah menerima pembayaran QRIS.

## 1. Ringkasan Situasi

1. Usaha sudah berjalan 1 tahun, laku, dan bertahan. Artinya produk sudah terbukti. Masalah utamanya bukan penjualan tapi pencatatan.
2. Pencatatan masih manual. Risiko yang biasa muncul dari kondisi ini yaitu tidak tahu untung bersih sebenarnya, tidak tahu produk mana yang paling menguntungkan, stok bahan sering meleset, dan sulit mengambil keputusan saat mau berkembang.
3. Pemilik ingin berkembang. Aplikasi harus dirancang untuk mendukung arah perkembangan itu, bukan sekadar mendigitalkan catatan.

## 2. Prinsip Perancangan

1. Aplikasi harus lebih cepat dari buku tulis. Kalau mencatat 1 transaksi butuh lebih dari 5 detik, penjual akan kembali ke cara manual.
2. Mulai dari masalah paling sakit, bukan dari fitur paling keren.
3. Bangun bertahap. Rilis kecil, dipakai, diperbaiki, baru tambah fitur.
4. Data harus aman walau HP hilang. Simpan di cloud dengan backup.
5. Harus bisa dipakai satu tangan sambil melayani pembeli, dan tetap jalan saat sinyal jelek.

## 3. Keputusan Penting Sebelum Koding

Ini keputusan yang jawabannya digali lewat kuesioner.

| Keputusan | Opsi | Penentu |
|---|---|---|
| Bikin sendiri atau pakai aplikasi kasir jadi | Bikin custom, atau pakai aplikasi kasir gratis semacam Kasir Pintar, majoo, atau Moka | Jika kebutuhan standar POS saja, aplikasi jadi lebih cepat dan murah. Bikin sendiri layak jika ada kebutuhan khusus, misal resep bahan baku, pre order, atau langganan pelanggan |
| Web app atau aplikasi Android | PWA berbasis web, atau APK Android | Jenis HP penjual, kebiasaan pemakaian, kebutuhan offline |
| Siapa yang input | Penjual sendiri, dibantu keluarga, atau ada karyawan | Menentukan perlu tidaknya multi user dan pembagian akses |
| Skala data | Satu lapak, atau rencana buka cabang dan reseller | Menentukan arsitektur dari awal |

Catatan jujur. Untuk usaha satu lapak, aplikasi kasir gratis yang sudah ada sering kali cukup untuk pencatatan penjualan. Nilai tambah bikin aplikasi sendiri muncul kalau kuesioner menemukan kebutuhan yang aplikasi jadi tidak punya, misalnya perhitungan HPP per resep jus, pencatatan produksi harian, atau manajemen pre order pelanggan tetap. Jawaban kuesioner yang menentukan.

## 4. Cakupan Fitur Berdasarkan Prioritas

### 4.1 Wajib ada di versi pertama (MVP)

1. Catat penjualan per transaksi. Pilih produk, jumlah, cara bayar tunai atau QRIS, selesai. Target di bawah 5 detik.
2. Daftar produk dan harga, termasuk varian botol dan cup.
3. Rekap harian otomatis. Omzet hari ini, jumlah cup atau botol terjual, produk terlaris.
4. Catat pengeluaran. Belanja bahan, es, kemasan, dan lain lain.
5. Laba kotor harian sederhana. Omzet dikurangi pengeluaran.

### 4.2 Versi kedua

1. Resep dan HPP per produk. Berapa biaya bahan untuk 1 botol Kurma Susu, sehingga terlihat margin per produk.
2. Stok bahan baku dengan pengurangan otomatis berdasarkan resep saat penjualan dicatat.
3. Catatan produksi harian. Berapa botol dibuat, berapa terjual, berapa sisa atau terbuang. Penting untuk produk segar tanpa pengawet.
4. Laporan mingguan dan bulanan, tren penjualan per produk, per hari, per jam.

### 4.3 Versi lanjut, sesuai arah pengembangan

1. Pre order dan pesanan pelanggan tetap, misal langganan mingguan.
2. Data pelanggan sederhana untuk promo lewat WhatsApp.
3. Multi lokasi kalau buka cabang atau titip jual.
4. Integrasi pesanan online kalau masuk GoFood atau GrabFood.

## 5. Usulan Teknologi

Ini usulan default jika hasil kuesioner mengarah ke bikin sendiri. Bisa berubah setelah kuesioner diisi.

| Komponen | Pilihan | Alasan |
|---|---|---|
| Bentuk | PWA, web app yang bisa dipasang di layar utama HP | Satu kode untuk semua HP, tidak perlu Play Store, update instan |
| Frontend | HTML sederhana atau React ringan | Cepat dibuat, ringan di HP murah |
| Backend dan database | Supabase atau Firebase paket gratis | Gratis untuk skala satu lapak, backup otomatis, login mudah |
| Offline | Simpan lokal dulu, sinkron saat ada sinyal | Lapak pinggir jalan sinyal tidak selalu stabil |
| Biaya operasional | Rp0 sampai skala cukup besar | Paket gratis Supabase atau Firebase cukup untuk ribuan transaksi per bulan |

## 6. Tahapan Kerja

| Tahap | Kegiatan | Durasi | Keluaran |
|---|---|---|---|
| 1. Penggalian | Isi kuesioner bersama penjual, amati 1 hari jualan kalau bisa | 1 minggu | Jawaban kuesioner, foto catatan manual sekarang |
| 2. Keputusan | Tentukan bikin sendiri atau pakai aplikasi jadi, tentukan fitur MVP | 2 sd 3 hari | Daftar fitur MVP final |
| 3. Rancang | Sketsa layar utama, alur input 5 detik, struktur data | 3 sd 4 hari | Mockup sederhana yang disetujui penjual |
| 4. Bangun MVP | Bangun fitur wajib bagian 4.1 | 2 sd 3 minggu | Aplikasi bisa dipakai jualan |
| 5. Uji lapangan | Penjual pakai paralel dengan catatan manual selama 1 minggu | 1 minggu | Daftar perbaikan |
| 6. Rilis | Lepas catatan manual, pantau 2 minggu | 2 minggu | Aplikasi jadi alat utama |
| 7. Iterasi | Tambah fitur versi kedua sesuai kebutuhan nyata | berkelanjutan | Rilis bertahap |

Total sampai rilis MVP sekitar 6 sd 8 minggu dengan pengerjaan santai.

## 7. Ukuran Keberhasilan

1. 100 persen transaksi tercatat di aplikasi dalam 1 bulan setelah rilis.
2. Penjual tahu laba kotor harian tanpa menghitung manual.
3. Penjual tahu 3 produk paling menguntungkan, bukan hanya paling laku.
4. Waktu tutup buku harian turun dari puluhan menit jadi di bawah 1 menit.
5. Keputusan pengembangan berikutnya, misal tambah varian atau buka titik baru, diambil berdasarkan data.

## 8. Risiko dan Cara Mengatasi

| Risiko | Cara mengatasi |
|---|---|
| Penjual malas input karena repot | Alur input maksimal 3 ketukan, uji langsung di lapak saat ramai |
| Aplikasi jadi tapi tidak dipakai | Libatkan penjual sejak mockup, mulai dari masalah yang dia rasakan sendiri |
| HP hilang atau rusak | Data di cloud, login dari HP mana pun |
| Fitur terlalu banyak di awal | Disiplin MVP, fitur versi 2 baru dibuat setelah MVP dipakai rutin 1 bulan |
| Sinyal jelek di lokasi | Mode offline dengan sinkron otomatis |

## 9. Langkah Berikutnya

1. Bawa kuesioner ke penjual, isi sambil ngobrol santai, jangan seperti ujian. Sesi 1 sd 2 jam atau dicicil.
2. Minta foto catatan manual yang sekarang dipakai. Ini data paling berharga untuk desain.
3. Kalau bisa, amati 1 hari jualan penuh. Hitung berapa transaksi per hari dan kapan jam ramai.
4. Kembali dengan jawaban kuesioner, lalu kita putuskan bersama arah teknis dan susun mockup.
