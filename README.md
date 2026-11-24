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
- Nilai tes: Panel Admin → Pendaftar PPDB → buka pendaftar → **Nilai tes** (Sholat, Tajwid + catatan, Pencapaian Hafalan, Tahfizh, Akademik). Tab **Rekap nilai & kelulusan**: atur komponen nilai (tambah/hapus/urutkan, bobot) dan batas lulus, urutkan tabel, unduh CSV, cetak, ubah kelulusan langsung di tabel, atau luluskan sekaligus yang mencapai batas. Nilai disimpan di tabel `pendaftar_nilai` dan hanya terlihat panitia.
- Pemasangan database (sekali, aman diulang): jalankan `supabase/ppdb-online.sql` di Supabase → SQL Editor. File ini juga menambahkan tautan Program Tahfizh & Program Takhassus ke submenu "Sekolah". Di Supabase → Authentication → Sign In / Providers: pastikan **Allow new users to sign up** aktif, dan matikan **Confirm email** kecuali sudah memasang SMTP sendiri (email bawaan Supabase hanya terkirim ke anggota tim).

### Program Tahfizh & Program Takhassus
- Halaman: `program-tahfizh.html` dan `program-takhassus.html` (isi dari `_includes/halaman-program.html`). Data program & lokasi kampus: Panel Admin → **Program & Kampus** (nama, jenjang, kampus, alamat, Google Maps, foto sampul, visi, misi).
- Program unggulan, rincian pembelajaran, fasilitas, ekstrakurikuler, foto galeri, dan video punya isian **Program** (Kedua program / Program Tahfizh / Program Takhassus). Kosong = tampil di kedua halaman program. Halaman Program & Sekolah dan Galeri punya tombol saring per program (`?p=tahfizh`).
- Nilai awal lokasi kampus ada di `scripts/bawaan.json` (kunci `@daftar`: isian baru di dalam item daftar, dicocokkan lewat nama program).
