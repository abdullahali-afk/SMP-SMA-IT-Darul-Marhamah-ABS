# Website SMP & SMA Islam Terpadu Darul Marhamah Al-Qur'an Boarding School

Alamat website: https://abdullahali-afk.github.io/SMP-SMA-IT-Darul-Marhamah-ABS/

Website ini gratis di GitHub Pages dan dibangun otomatis (Jekyll) setiap kali ada perubahan.

## Panel admin (tanpa coding)

Alamat panel: **https://abdullahali-afk.github.io/SMP-SMA-IT-Darul-Marhamah-ABS/admin/**

Panel memakai database Supabase (gratis). Setiap akun punya **peran** (Admin, Guru, Pegawai, atau peran buatan sendiri), dan setiap peran hanya bisa membuka bagian yang dicentang admin.

### Menyiapkan pertama kali (sekali saja)
1. Buka Supabase → project ini → **SQL Editor** → **New query**. Tempel seluruh isi file `supabase/setup.sql`, lalu klik **Run**.
2. **Authentication → Sign In / Providers → Email**: matikan **Confirm email**, lalu Save. (Email bawaan Supabase hanya terkirim ke anggota tim Supabase, jadi konfirmasi email untuk guru tidak akan sampai.)
3. **Authentication → URL Configuration**: isi **Site URL** dan **Redirect URLs** dengan alamat panel di atas.
4. Buka alamat panel, klik **Daftar**. **Akun pertama yang mendaftar otomatis menjadi Admin**, jadi segera daftar setelah langkah 1.

### Sehari-hari
- **Pengguna**: buat akun guru/pegawai langsung (nama, email, password awal, peran), setujui akun yang mendaftar sendiri, ganti password, nonaktifkan, atau hapus akun.
- **Peran & Hak Akses**: centang/hapus centang bagian yang boleh dikelola setiap peran (buka/tutup akses), tambah atau hapus peran.
- **Menu Website**: tambah, hapus, urutkan menu dan submenu.
- **Berita**, **Beranda**, **Data Sekolah**, **PPDB**, **Guru & Staf**, **Struktur**, **Galeri**, **Video**, **Testimoni**, **Fasilitas**, **Program**, **Download**.
- **Pengaturan Akun**: ganti nama tampilan dan password sendiri.

Perubahan di panel disalin ke website oleh GitHub Actions (`.github/workflows/sinkron.yml` + `scripts/pantau.sh`). Pukul 05.00–23.00 WITA workflow ini terus memantau database dan menerbitkan perubahan ±2–3 menit setelah tombol Simpan diklik, tanpa perlu token apa pun. Di luar jam itu berjalan sekitar sekali sejam. **Penerbitan otomatis** di bawah bersifat tambahan (opsional). Untuk menyalin segera secara manual: tab **Actions → Sinkron panel admin → Run workflow**.

### Penerbitan otomatis (sekali pasang)
1. Buat token GitHub: https://github.com/settings/personal-access-tokens/new
   - Token name: `Panel admin website`; Expiration: pilih yang paling lama.
   - Repository access: **Only select repositories** → `SMP-SMA-IT-Darul-Marhamah-ABS`.
   - Permissions → Repository permissions → **Actions: Read and write**.
   - Klik **Generate token**, lalu salin tokennya (diawali `github_pat_`).
2. Supabase → **SQL Editor → New query** → tempel seluruh isi `supabase/terbit-otomatis.sql` tanpa diubah → **Run** (jika muncul peringatan, klik **Run this query**).
3. **New query** lagi, ketik satu baris berikut dengan token Anda di antara tanda kutip, lalu **Run**:
   `select public.atur_token_terbit('github_pat_...');`
4. Jika token kedaluwarsa, buat token baru dan ulangi langkah 3 saja. Jangan kirim token ke siapa pun.

## Struktur file
| File / folder | Isi |
|---|---|
| `admin/` | Panel admin (`konfigurasi.json` berisi Project URL & publishable key Supabase) |
| `supabase/setup.sql` | Tabel, peran, hak akses, dan isi awal database |
| `scripts/sinkron.mjs` | Menyalin isi database ke `_data/` dan `_posts/` |
| `_data/*.json` / `*.yml` | Isi halaman (dibuat otomatis dari panel, jangan diubah manual) |
| `_posts/` | Berita (dibuat otomatis dari panel) |
| `_layouts/`, `_includes/`, `*.html`, `assets/style.css` | Tampilan |

## Memasang domain sendiri (.com / .sch.id) nanti
1. Beli domain (misalnya di Niagahoster, Rumahweb, Cloudflare). Domain `.sch.id` bisa didaftarkan untuk sekolah resmi.
2. Di pengelola DNS domain, buat record:
   - `A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` `www` → `abdullahali-afk.github.io`
3. Di GitHub: **Settings → Pages → Custom domain**, isi nama domain, lalu centang **Enforce HTTPS**.
4. Di `_config.yml`, ubah `baseurl` menjadi `""` dan `url` menjadi alamat domain baru.
5. Di Supabase → Authentication → URL Configuration, ganti alamat panel admin dengan domain baru.

### Peta lokasi sekolah (Google Maps)
Panel Admin → **Data Sekolah & Kontak** → isian **Lokasi Google Maps** di bagian Data SMA dan Data SMP. Buka Google Maps, cari sekolahnya, klik **Bagikan → Salin link**, lalu tempel. Boleh juga kode **Sematkan peta**, koordinat (`-5.13, 119.49`), atau alamat. Link pendek `maps.app.goo.gl` dibuka otomatis saat penerbitan (`admin/peta.js` + `scripts/sinkron.mjs`). Jika dikosongkan, peta memakai alamat sekolah.

### Video testimoni
Panel Admin → **Testimoni** → buka satu testimoni → isian **Link video testimoni**. Tempel link YouTube (termasuk Shorts), Google Drive (dibagikan "Siapa saja yang memiliki link"), Instagram, TikTok, atau Facebook. Video YouTube diputar langsung di kartu testimoni saat diklik; platform lain memakai pemutar bawaannya. Parser: `admin/video.js` (dipakai juga oleh `scripts/sinkron.mjs`, yang membuka link pendek vt.tiktok.com / fb.watch).

### Isian baru pada bagian yang sudah ada
Jika sebuah isian ditambahkan ke `admin/skema.js` untuk bagian yang sudah tersimpan di database, isi awalnya ditaruh di `scripts/bawaan.json` (per kunci bagian). Sinkron memakai nilai itu selama isian tersebut belum pernah disimpan dari panel, dan panel menampilkannya sebagai isian awal. Contoh: `ppdb.langkah` (Alur pendaftaran 01–10).

### PPDB Online (akun & dashboard calon santri)
- Halaman calon santri: `/pendaftaran/` (`pendaftaran/index.html`, `assets/ppdb-online.js`, `assets/ppdb-online.css`). Calon santri membuat akun, lalu mengikuti 10 langkah: bayar registrasi (unggah bukti), pilih sekolah, biodata, wawancara, join grup WA, tes tahap awal, tes tahap akhir (unggah surat kesehatan), pengumuman kelulusan.
- Panitia: Panel Admin → **Pendaftar PPDB** (melihat berkas, biodata, wawancara, mengubah status, unduh CSV, link grup WA). Hak akses "Pendaftar PPDB" dibuka admin di **Peran & Hak Akses**.
- Pengaturan teks (biaya registrasi, info tes, pesan lulus, pertanyaan wawancara): Panel Admin → **Info PPDB** → bagian *PPDB Online*. Formulir biodata: `admin/ppdb-formulir.js`.
- Nilai tes: Panel Admin → Pendaftar PPDB → buka pendaftar → **Nilai tes** (Sholat, Tajwid + catatan, Pencapaian Hafalan, Tahfizh, Akademik). Tab **Rekap nilai & kelulusan**: atur komponen nilai (tambah/hapus/urutkan, bobot) dan batas lulus, urutkan tabel, unduh CSV, cetak, ubah kelulusan langsung di tabel, atau luluskan sekaligus yang mencapai batas. Nilai disimpan di tabel `pendaftar_nilai` dan hanya terlihat panitia dan penguji.
- Surah hafalan yang diujikan: Rekap nilai & kelulusan → **Pengaturan nilai** → komponen "Pencapaian Hafalan" → isian **Surah / ayat yang diujikan** dan **Nilai / jumlah maksimal**. Isian **Berlaku untuk jenjang** (Semua jenjang / SMP / SMA) dipakai jika materi tes SMP dan SMA berbeda.
- Berkas syarat lulus Tes Tahap Akhir (langkah 09): Pendaftar PPDB → tab **Berkas & tagihan** → **Pengaturan berkas syarat lulus**: tambah/hapus/urutkan berkas, unggah file format (Word/PDF) yang bisa diunduh calon santri, tandai wajib/tidak wajib. Bawaan: Surat Hasil Pemeriksaan Kesehatan, Bukti Bayar Administrasi (jenis Pembayaran, isi total biaya SMP/SMA), Surat Pernyataan Menaati Peraturan Pondok. Panitia memeriksa di halaman pendaftar (panel "09 · Berkas syarat lulus"): Terima, Tolak dengan alasan, atau untuk Pembayaran "Terima & catat pembayaran" (total + nominal dibayar). Jika belum lunas, sisanya tercatat di tabel `tagihan` (riwayat di `pembayaran`), siap dipakai modul keuangan nanti. Tab Berkas & tagihan juga menampilkan rekap per santri dan unduhan CSV tagihan. Data: `ppdb_syarat`, `pendaftar_berkas`, `tagihan`, `pembayaran`, fungsi `terima_pembayaran_ppdb()`.
- Penguji (guru yang mengisi nilai tes): Panel Admin → **Pengguna** → ubah peran akunnya menjadi **Penguji SPMB** (dibuat oleh `ppdb-online.sql`), atau centang **Input Nilai SPMB** untuk peran mana pun di **Peran & Hak Akses**. Penguji membuka menu **Input Nilai SPMB** (`#/nilai-tes`), hanya melihat nomor, nama, dan pilihan sekolah peserta (fungsi database `peserta_tes()`), dan bisa mengisi/mengubah nilai, tetapi tidak bisa melihat biodata/berkas, mengubah pengaturan nilai, menghapus nilai, atau mengubah kelulusan.
- Data per program: halaman Pendaftar PPDB (Daftar pendaftar, Rekap nilai, Berkas & tagihan) dan Input Nilai SPMB punya tombol **Program Takhassus / Program Tahfizh / Belum memilih program / Semua program**. SMP dan SMA dalam satu program digabung; pakai saringan jenjang untuk memisahkannya. Pilihan terakhir diingat di browser, dan nama file CSV diberi akhiran program (`-takhassus` / `-tahfizh`). Calon santri sekarang memilih program dulu, baru jenjang.
- Ketua Panitia PPDB per program: Panel Admin → **Pengguna** → peran **Ketua Panitia PPDB** (dibuat oleh `ppdb-online.sql`, akses Pendaftar PPDB + Input Nilai SPMB) lalu kolom **Program PPDB** = Program Tahfizh atau Program Takhassus. Akun itu (juga Penguji SPMB yang diberi program) hanya melihat dan mengubah pendaftar program tersebut serta pendaftar yang belum memilih program (agar bukti bayar registrasi tetap bisa dicek), dibatasi di database (`profil.program_ppdb`, fungsi `program_saya()`, `panitia_untuk()`). Pengaturan bersama (komponen nilai, batas lulus, berkas syarat lulus) hanya bisa diubah admin atau panitia "Semua program". Admin selalu melihat semua program.
- Grup WhatsApp Santri Baru: Pendaftar PPDB → **Link grup WhatsApp Santri Baru** (bisa per program dan per jenjang). Begitu calon santri dinyatakan lulus Tes Tahap Akhir (atau LULUS, bukan cadangan), tombol gabung grup otomatis muncul di bagian atas dashboard-nya; sebelum itu link tidak terlihat (fungsi database `grup_santri_baru()`, tabel `ppdb_grup_lulus`). Saat tombol ditekan, kolom `pendaftar.gabung_santri_baru` tercatat. Panitia bisa menyaring "Lulus tahap akhir, belum buka grup Santri Baru" dan, di halaman pendaftar, mengirim link lewat WhatsApp panitia. WhatsApp tidak mengizinkan website memasukkan nomor ke grup secara otomatis, jadi calon santri tetap menekan link undangan sendiri.
- Pemasangan database (sekali, aman diulang): jalankan `supabase/ppdb-online.sql` di Supabase → SQL Editor. File ini juga menambahkan tautan Program Tahfizh & Program Takhassus ke submenu "Sekolah". Di Supabase → Authentication → Sign In / Providers: pastikan **Allow new users to sign up** aktif, dan matikan **Confirm email** kecuali sudah memasang SMTP sendiri (email bawaan Supabase hanya terkirim ke anggota tim).

### Program Tahfizh & Program Takhassus
- Halaman: `program-tahfizh.html` dan `program-takhassus.html` (isi dari `_includes/halaman-program.html`). Data program & lokasi kampus: Panel Admin → **Program & Kampus** (nama, jenjang, kampus, alamat, Google Maps, foto sampul, visi, misi).
- Program unggulan, rincian pembelajaran, fasilitas, ekstrakurikuler, foto galeri, dan video punya isian **Program** (Kedua program / Program Tahfizh / Program Takhassus). Kosong = tampil di kedua halaman program. Halaman Program & Sekolah dan Galeri punya tombol saring per program (`?p=tahfizh`).
- Di panel admin, setiap daftar yang punya isian Program (fasilitas, ekstrakurikuler, unggulan, kurikulum, galeri, video) punya tombol **Program Takhassus / Program Tahfizh / Kedua program / Semua**. Tiap program diisi dengan itemnya sendiri: pilih tombol program, lalu **+ Tambah item** (program otomatis terisi). Tombol **Salin daftar dari program lain (tanpa foto)** menyalin nama & ikon agar tinggal mengunggah foto program itu. Item "Kedua program" (tampil di kedua halaman program) bisa dipecah dengan **Pisahkan per program** agar tiap program punya item dan foto sendiri. Jangan mengubah isian Program pada item yang sudah ada jika maksudnya menambah item untuk program lain, karena item itu akan pindah program.
- Nilai awal lokasi kampus ada di `scripts/bawaan.json` (kunci `@daftar`: isian baru di dalam item daftar, dicocokkan lewat nama program).
