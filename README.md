# Website SMP & SMA Islam Terpadu Darul Marhamah Al-Qur'an Boarding School

Alamat website: https://abdullahali-afk.github.io/SMP-SMA-IT-Darul-Marhamah-ABS/

Website ini gratis di GitHub Pages dan dibangun otomatis (Jekyll) setiap kali ada perubahan.

## Panel admin (tanpa coding)

1. Buka **https://app.pagescms.org** lalu klik **Sign in with GitHub**.
2. Login dengan akun GitHub pemilik repo (**abdullahali-afk**). Jika diminta, izinkan (Authorize/Install) aplikasi Pages CMS untuk repo `SMP-SMA-IT-Darul-Marhamah-ABS`.
3. Pilih repo **SMP-SMA-IT-Darul-Marhamah-ABS**, branch **main**.
4. Menu di kiri:
   - **Berita**: tambah, ubah, hapus berita (judul, tanggal, kategori, foto, isi).
   - **Data Sekolah & Kontak**: nama, slogan, WhatsApp, alamat, NPSN, visi misi, sejarah, statistik, video YouTube, media sosial.
   - **Info PPDB**: tahun ajaran, jadwal, syarat, biaya, rekening, brosur.
   - **Guru & Staf**, **Galeri Foto**, **Testimoni**, **Fasilitas & Ekstrakurikuler**, **Program Unggulan**.
   - **Media**: semua foto yang diunggah (tersimpan di `assets/img`).
5. Klik **Save**. Website diperbarui otomatis dalam 1–2 menit.

### Menambah admin lain
Admin = akun GitHub yang punya akses ke repo ini. Untuk menambah admin (misal staf TU):
GitHub → repo ini → **Settings → Collaborators → Add people**, masukkan username GitHub mereka.
Setelah mereka menerima undangan, mereka bisa login di app.pagescms.org dengan akunnya sendiri.
Hapus dari daftar Collaborators untuk mencabut akses.

## Struktur file
| File / folder | Isi |
|---|---|
| `_data/sekolah.yml` | Data sekolah & kontak |
| `_data/ppdb.yml` | Info PPDB |
| `_data/guru.yml`, `galeri.yml`, `testimoni.yml`, `fasilitas.yml`, `program.yml` | Isi halaman |
| `_posts/` | Berita (satu file per berita) |
| `assets/img/` | Foto yang diunggah |
| `_layouts/`, `_includes/`, `*.html`, `assets/style.css` | Tampilan (tidak perlu diubah) |
| `.pages.yml` | Pengaturan panel admin |

## Memasang domain sendiri (.com / .sch.id) nanti
1. Beli domain (misalnya di Niagahoster, Rumahweb, Cloudflare). Domain `.sch.id` bisa didaftarkan untuk sekolah resmi.
2. Di pengelola DNS domain, buat record:
   - `A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` `www` → `abdullahali-afk.github.io`
3. Di GitHub: **Settings → Pages → Custom domain**, isi nama domain, lalu centang **Enforce HTTPS**.
4. Di `_config.yml`, ubah `baseurl` menjadi `""` dan `url` menjadi alamat domain baru.
