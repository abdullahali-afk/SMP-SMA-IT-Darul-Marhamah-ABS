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
