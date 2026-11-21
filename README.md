# Website SMP-SMA Islam Terpadu Darul Marhamah ABS

Website statis (HTML + CSS) yang di-hosting gratis di GitHub Pages.

Alamat website: https://abdullahali-afk.github.io/SMP-SMA-IT-Darul-Marhamah-ABS/

## Halaman
| File | Halaman |
|---|---|
| `index.html` | Beranda |
| `profil.html` | Profil, sejarah, visi & misi, data sekolah |
| `guru.html` | Guru & tenaga kependidikan |
| `berita.html` | Berita & kegiatan |
| `galeri.html` | Galeri foto |
| `sekolah.html` | Jenjang SMP & SMA |
| `ppdb.html` | Penerimaan Peserta Didik Baru (formulir via WhatsApp) |
| `kontak.html` | Kontak & peta |

## Cara mengedit (langsung di GitHub, tanpa install apa pun)
1. Buka file yang ingin diubah, misalnya `profil.html`.
2. Klik ikon pensil (✏️ *Edit this file*).
3. Cari teks dalam kurung siku `[ ... ]`, itu adalah contoh yang perlu diganti dengan data asli.
4. Klik **Commit changes**. Website akan otomatis diperbarui dalam 1–2 menit.

**Penting:** nomor WhatsApp `6285211869470` (0852-1186-9470) dipakai untuk tombol WhatsApp dan formulir PPDB/kontak.
Ganti di semua file dengan nomor sekolah (format `62...` tanpa `+` dan tanpa `0` di depan).

## Menambah foto
1. Masuk folder `assets`, klik **Add file → Upload files**, unggah ke `assets/img/`.
2. Di `galeri.html`, ganti emoji di dalam `<figure>` dengan `<img src="assets/img/namafoto.jpg" alt="keterangan">`.
3. Logo: ganti file `assets/logo.svg` (atau unggah `logo.png` lalu ubah `logo.svg` menjadi `logo.png` di semua halaman).

## Memasang domain sendiri (.com / .sch.id) nanti
1. Beli domain (misalnya di Niagahoster, Rumahweb, Cloudflare). Domain `.sch.id` bisa didaftarkan untuk sekolah resmi.
2. Di pengelola DNS domain, buat record:
   - `A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` `www` → `abdullahali-afk.github.io`
3. Di GitHub: **Settings → Pages → Custom domain**, isi nama domain, lalu centang **Enforce HTTPS**.
