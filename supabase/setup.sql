-- =====================================================================
--  Database panel admin Darul Marhamah ABS (Supabase)
--  Cara pakai: Supabase → SQL Editor → New query → tempel semua isi file
--  ini → klik RUN. Aman dijalankan ulang.
-- =====================================================================

-- ---------- 1. Peran (tingkatan akun) & hak akses ----------
create table if not exists public.peran (
  kode   text primary key,
  nama   text not null,
  akses  text[] not null default '{}',
  urutan int  not null default 50
);

insert into public.peran (kode, nama, akses, urutan) values
  ('admin',    'Admin',                 array['*'], 0),
  ('guru',     'Guru',                  array['berita','galeri','video'], 10),
  ('pegawai',  'Pegawai / Staf TU',     array['berita','galeri','ppdb','download'], 20),
  ('menunggu', 'Menunggu persetujuan',  '{}', 99)
on conflict (kode) do nothing;

-- ---------- 2. Profil pengguna ----------
create table if not exists public.profil (
  id     uuid primary key references auth.users on delete cascade,
  email  text,
  nama   text,
  peran  text not null default 'menunggu' references public.peran(kode) on update cascade,
  aktif  boolean not null default true,
  dibuat timestamptz not null default now()
);

-- Akun pertama yang mendaftar otomatis menjadi Admin; berikutnya "menunggu".
create or replace function public.buat_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profil (id, email, nama, peran)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nama', ''),
          case when (select count(*) from public.profil) = 0 then 'admin' else 'menunggu' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists saat_daftar on auth.users;
create trigger saat_daftar after insert on auth.users
  for each row execute function public.buat_profil();

-- ---------- 3. Fungsi bantu hak akses ----------
create or replace function public.boleh(bagian text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profil p join public.peran r on r.kode = p.peran
    where p.id = auth.uid() and p.aktif
      and ('*' = any(r.akses) or bagian = any(r.akses)))
$$;

create or replace function public.adalah_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.boleh('*')
$$;

create or replace function public.ubah_nama_saya(nama_baru text) returns void
language sql security definer set search_path = public as $$
  update public.profil set nama = nama_baru where id = auth.uid()
$$;

-- Khusus admin: membuat/mengganti password akun lain (sekaligus mengaktifkan
-- email akun tsb.) dan menghapus akun sepenuhnya.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_atur_password(pengguna uuid, password_baru text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.adalah_admin() then raise exception 'Hanya admin yang boleh mengganti password akun lain'; end if;
  if length(coalesce(password_baru, '')) < 6 then raise exception 'Password minimal 6 karakter'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(password_baru, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = pengguna;
  if not found then raise exception 'Akun tidak ditemukan'; end if;
end $$;

create or replace function public.admin_hapus_akun(pengguna uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.adalah_admin() then raise exception 'Hanya admin yang boleh menghapus akun'; end if;
  if pengguna = auth.uid() then raise exception 'Tidak bisa menghapus akun sendiri'; end if;
  delete from auth.users where id = pengguna;
end $$;

revoke execute on function public.admin_atur_password(uuid, text) from public, anon;
revoke execute on function public.admin_hapus_akun(uuid) from public, anon;
grant execute on function public.admin_atur_password(uuid, text) to authenticated;
grant execute on function public.admin_hapus_akun(uuid) to authenticated;

-- ---------- 4. Isi website ----------
create table if not exists public.konten (
  kunci       text primary key,
  data        jsonb not null,
  diubah      timestamptz not null default now(),
  diubah_oleh uuid default auth.uid()
);

create table if not exists public.berita (
  id        uuid primary key default gen_random_uuid(),
  judul     text not null,
  slug      text,
  tanggal   date not null default current_date,
  kategori  text default 'Kegiatan',
  gambar    text default '',
  ringkasan text default '',
  isi       text default '',
  terbit    boolean not null default true,
  penulis   uuid default auth.uid(),
  dibuat    timestamptz not null default now(),
  diubah    timestamptz not null default now()
);

-- ---------- 5. Keamanan (Row Level Security) ----------
alter table public.peran  enable row level security;
alter table public.profil enable row level security;
alter table public.konten enable row level security;
alter table public.berita enable row level security;

drop policy if exists "peran dibaca pengguna" on public.peran;
create policy "peran dibaca pengguna" on public.peran for select to authenticated using (true);
drop policy if exists "peran diatur admin" on public.peran;
create policy "peran diatur admin" on public.peran for all to authenticated
  using (public.adalah_admin()) with check (public.adalah_admin());

drop policy if exists "profil sendiri atau admin" on public.profil;
create policy "profil sendiri atau admin" on public.profil for select to authenticated
  using (id = auth.uid() or public.adalah_admin());
drop policy if exists "profil diatur admin" on public.profil;
create policy "profil diatur admin" on public.profil for update to authenticated
  using (public.adalah_admin()) with check (public.adalah_admin());
drop policy if exists "profil dihapus admin" on public.profil;
create policy "profil dihapus admin" on public.profil for delete to authenticated
  using (public.adalah_admin() and id <> auth.uid());

drop policy if exists "konten publik" on public.konten;
create policy "konten publik" on public.konten for select using (true);
drop policy if exists "konten diubah sesuai akses" on public.konten;
create policy "konten diubah sesuai akses" on public.konten for update to authenticated
  using (public.boleh(kunci)) with check (public.boleh(kunci));
drop policy if exists "konten ditambah admin" on public.konten;
create policy "konten ditambah admin" on public.konten for insert to authenticated
  with check (public.boleh(kunci));

drop policy if exists "berita publik" on public.berita;
create policy "berita publik" on public.berita for select using (terbit or public.boleh('berita'));
drop policy if exists "berita dikelola" on public.berita;
create policy "berita dikelola" on public.berita for all to authenticated
  using (public.boleh('berita')) with check (public.boleh('berita'));

-- ---------- 6. Penyimpanan foto & file ----------
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media dibaca publik" on storage.objects;
create policy "media dibaca publik" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media diunggah staf" on storage.objects;
create policy "media diunggah staf" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and exists (
    select 1 from public.profil p join public.peran r on r.kode = p.peran
    where p.id = auth.uid() and p.aktif and cardinality(r.akses) > 0));
drop policy if exists "media dihapus admin" on storage.objects;
create policy "media dihapus admin" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.adalah_admin());


-- ---------- 7. Isi awal website (tidak menimpa isi yang sudah ada) ----------
insert into public.konten (kunci, data) values ('menu', $isi${"daftar": [{"judul": "Beranda", "link": "/"}, {"judul": "Profil", "link": "/profil.html", "sub": [{"judul": "Selayang Pandang", "link": "/profil.html#selayang"}, {"judul": "Visi & Misi", "link": "/profil.html#visi-misi"}, {"judul": "Program Unggulan", "link": "/sekolah.html#program"}, {"judul": "Fasilitas", "link": "/sekolah.html#fasilitas"}, {"judul": "Struktur Organisasi", "link": "/struktur.html"}, {"judul": "Guru & Staf", "link": "/guru.html"}, {"judul": "Testimoni", "link": "/testimoni.html"}]}, {"judul": "Sekolah", "link": "/sekolah.html", "sub": [{"judul": "SMP IT Darul Marhamah ABS", "link": "/sekolah.html#smp"}, {"judul": "SMA IT Darul Marhamah ABS", "link": "/sekolah.html#sma"}, {"judul": "Ekstrakurikuler", "link": "/sekolah.html#ekskul"}]}, {"judul": "Berita", "link": "/berita.html"}, {"judul": "Galeri", "link": "/galeri.html", "sub": [{"judul": "Foto", "link": "/galeri.html"}, {"judul": "Video", "link": "/galeri.html#video"}, {"judul": "Download", "link": "/download.html"}]}, {"judul": "Kontak", "link": "/kontak.html", "sub": [{"judul": "Kontak & Lokasi", "link": "/kontak.html"}, {"judul": "Layanan & Call Center", "link": "/layanan.html"}, {"judul": "Rekening", "link": "/layanan.html#rekening"}, {"judul": "Kritik & Saran", "link": "/layanan.html#saran"}]}, {"judul": "Info PPDB", "link": "/ppdb.html", "tombol": true, "sub": [{"judul": "Daftar Sekarang", "link": "/ppdb.html#daftar"}, {"judul": "Panduan Pendaftaran", "link": "/ppdb.html#panduan"}, {"judul": "Rincian Biaya", "link": "/ppdb.html#biaya"}]}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('sekolah', $isi${"nama_singkat": "Darul Marhamah ABS", "nama_lengkap": "SMP & SMA Islam Terpadu Darul Marhamah Al-Qur'an Boarding School", "slogan": "Karena Wanita adalah Rahim Peradaban", "deskripsi": "Boarding school putri di Kota Makassar yang membina muslimah penghafal Al-Qur'an, berakhlak mulia, dan unggul dalam ilmu.", "whatsapp": "6285211869470", "telepon": "0852-1186-9470", "email": "darulmarhamah03@gmail.com", "jam_kantor": "Senin – Sabtu, 07.30 – 15.00 WITA", "yayasan": "Yayasan Mutiara Alquran Alislamiyah", "tahun_berdiri": "2023", "sejarah": "Darul Marhamah Al-Qur'an Boarding School adalah sekolah berasrama khusus putri di Kota Makassar dengan jenjang SMP dan SMA. Berangkat dari keyakinan \"Karena Wanita adalah Rahim Peradaban\", kami mendidik santriwati agar menjadi muslimah yang cerdas, shalihah, dan kelak melahirkan generasi terbaik.\n\nDengan jenjang SMP dan SMA dalam satu lembaga, pembinaan santriwati dapat berlangsung berkesinambungan selama enam tahun. [Tambahkan sejarah singkat, tahun berdiri, dan nama yayasan.]", "visi": "\"Menjadi sekolah model Al-Qur’an\"", "misi": ["Melahirkan Muslimah yang Berkarakter dan Berakhlaq Qur'ani", "Melahirkan Muslimah Penghafal Al-Qur'an yang Mutqin", "Melahirkan Muslimah Da'iyah Pejuang Al-Qur'an", "Melahirkan Muslimah yang Peka dengan Lingkungan Sosialnya", "Melahirkan Muslimah yang Kreatif, Inovatif dan Pantang Menyerah", "Melahirkan Calon Ibu Pendidik Generasi Al-Qur'an"], "smp": {"nama": "SMP Islam Terpadu Darul Marhamah Al-Qur'an Boarding School", "npsn": "70036850", "alamat": "Jl. Sukamaju III No. 66, Kel. Tamamaung, Kota Makassar", "kepala_sekolah": "[Nama Kepala SMP]", "akreditasi": "[A]", "target_hafalan": "[15 juz]", "keterangan": "Untuk lulusan SD/MI (putri). Fokus pada tahsin, dasar hafalan, dan penguatan akhlak.", "peta": "Jl. Sukamaju 3 No 66 Tamamaung Makassar"}, "sma": {"nama": "SMA Islam Terpadu Darul Marhamah Al-Qur'an Boarding School", "npsn": "70043438", "alamat": "Jl. Perintis Kemerdekaan III, BTN Asal Mula Blok E2 No. 7B, Kota Makassar", "kepala_sekolah": "Abdullah, S.H., M.H.", "akreditasi": "[A]", "target_hafalan": "[30 juz]", "peta": "Jl. Perintis Kemerdekaan 3 BTN Asal Mula Blok E2/B Tamalanrea Indah Kota Makassar"}, "statistik": [{"angka": "[300]", "label": "Santriwati"}, {"angka": "[35]", "label": "Guru & Staf"}, {"angka": "[50]", "label": "Penghafal 10+ Juz"}, {"angka": "[100]", "label": "Prestasi"}], "sosmed": {"facebook": "https://www.facebook.com/people/Darul-Marhamah-Al-Quran-Boarding-School-Makassar/100063824633527/", "instagram": "https://www.instagram.com/darulmarhamah_abs/", "youtube": "https://www.youtube.com/@marhamahtv6242", "tiktok": "https://www.tiktok.com/@darul.marhamah.abs?lang=en"}}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('beranda', $isi${"hero": [{"judul_arab": "أَهْلًا وَسَهْلًا بِكُمْ فِي دَارِ الْمَرْحَمَة", "judul": "Selamat Datang di Darul Marhamah Al-Qur'an Boarding School", "sub": "SMP & SMA Islam Terpadu khusus putri di Kota Makassar. Karena Wanita adalah Rahim Peradaban.", "foto": "", "tombol": "MENJADI BAGIAN", "link": "/ppdb.html"}, {"judul_arab": "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ", "judul": "Mencetak Muslimah Penghafal Al-Qur'an", "sub": "Program tahfidz terbimbing, bahasa Arab aktif, dan pembinaan adab di lingkungan asrama yang aman.", "foto": "", "tombol": "INFO PPDB", "link": "/ppdb.html"}], "tautan": [{"ikon": "🏫", "judul": "Tentang Darul Marhamah", "isi": "Mengenal sejarah, visi misi, dan lembaga yang menaungi sekolah.", "link": "/profil.html"}, {"ikon": "🌙", "judul": "Kehidupan Asrama", "isi": "Keseharian santriwati: ibadah berjamaah, halaqah tahfidz, dan kegiatan asrama.", "link": "/galeri.html"}, {"ikon": "⭐", "judul": "Mengapa Memilih Kami", "isi": "Alasan orang tua mempercayakan pendidikan putrinya kepada kami.", "link": "/#alasan"}, {"ikon": "🤝", "judul": "Ruang Kolaborasi", "isi": "Peluang kerja sama dengan orang tua, alumni, lembaga, dan masyarakat.", "link": "/layanan.html"}], "foto_visi": "", "capaian": {"judul": "Capaian Kami", "teks": "Sejak berdiri pada tahun 2023, Darul Marhamah Al-Qur'an Boarding School terus berkembang dalam membina muslimah penghafal Al-Qur'an di Kota Makassar. [Sesuaikan teks capaian sekolah.]"}, "alasan": {"foto": "", "daftar": [{"judul": "Fokus Al-Qur'an", "isi": "Target hafalan terukur dengan setoran harian dan ujian tasmi' berkala."}, {"judul": "Bahasa Arab Aktif", "isi": "Bahasa Arab menjadi bekal memahami Al-Qur'an, hadits, dan kitab para ulama."}, {"judul": "Pembinaan Karakter", "isi": "Adab islami dibiasakan setiap hari bersama ustadzah dan musyrifah."}, {"judul": "Asrama Putri yang Aman", "isi": "Lingkungan khusus putri yang terjaga, nyaman, dan diawasi 24 jam."}, {"judul": "Kurikulum Lengkap", "isi": "Kurikulum nasional tetap utuh sehingga lulusan siap ke jenjang berikutnya."}]}, "alumni": {"judul": "Kontribusi dan Kiprah Alumni", "teks": "Alumni Darul Marhamah diharapkan menjadi muslimah yang berperan di keluarga dan masyarakat: sebagai pendidik, penghafal Al-Qur'an, dan da'iyah. [Tambahkan kisah alumni.]", "link": "/testimoni.html"}, "layanan": [{"nama": "Layanan Akademik", "link": "/kontak.html"}, {"nama": "Layanan Asrama", "link": "/kontak.html"}, {"nama": "Administrasi / Tata Usaha", "link": "/kontak.html"}, {"nama": "Keuangan & Rekening", "link": "/layanan.html#rekening"}, {"nama": "Media dan Humas", "link": "/kontak.html"}], "call_center": [{"bagian": "Akademik", "nomor": "0852-1186-9470"}, {"bagian": "Keuangan", "nomor": "0852-1186-9470"}, {"bagian": "Keasramaan", "nomor": "0852-1186-9470"}, {"bagian": "Kesantriwatian", "nomor": "0852-1186-9470"}, {"bagian": "PPDB", "nomor": "0852-1186-9470"}], "mitra": []}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('ppdb', $isi${"tahun_ajaran": "2027/2028", "status": "Pendaftaran dibuka", "alur": [{"judul": "Isi Formulir", "isi": "Isi formulir di halaman ini atau datang langsung ke sekolah."}, {"judul": "Bayar Pendaftaran", "isi": "Transfer biaya pendaftaran ke rekening sekolah (lihat di bawah)."}, {"judul": "Tes Seleksi", "isi": "Tes akademik, baca Al-Qur'an, hafalan, dan wawancara calon santriwati & orang tua."}, {"judul": "Pengumuman", "isi": "Hasil seleksi diumumkan melalui WhatsApp."}, {"judul": "Daftar Ulang", "isi": "Melengkapi administrasi dan berkas untuk menjadi santriwati resmi."}], "gelombang": [{"nama": "Gelombang 1", "waktu": "[1 November – 31 Desember 2026]"}, {"nama": "Gelombang 2", "waktu": "[1 Januari – 28 Februari 2027]"}, {"nama": "Gelombang 3", "waktu": "[1 Maret – 30 April 2027]"}], "syarat": ["Calon santriwati (perempuan)", "SMP: lulusan SD/MI sederajat", "SMA: lulusan SMP/MTs sederajat", "Bersedia tinggal di asrama", "Fotokopi ijazah/SKL dan rapor terakhir", "Fotokopi Akta Kelahiran & Kartu Keluarga", "Pas foto 3×4 (4 lembar)", "Mampu membaca Al-Qur'an"], "biaya": [{"komponen": "Pendaftaran", "smp": "Rp [000.000]", "sma": "Rp [000.000]"}, {"komponen": "Uang pangkal (bisa dicicil)", "smp": "Rp [0.000.000]", "sma": "Rp [0.000.000]"}, {"komponen": "Asrama & makan per bulan", "smp": "Rp [000.000]", "sma": "Rp [000.000]"}, {"komponen": "Seragam & perlengkapan", "smp": "Rp [0.000.000]", "sma": "Rp [0.000.000]"}, {"komponen": "SPP per bulan", "smp": "Rp [000.000]", "sma": "Rp [000.000]"}], "catatan_biaya": "*Tersedia beasiswa untuk santriwati berprestasi dan penghafal Al-Qur'an. [Sesuaikan]", "rekening": "[Nama Bank – No. Rekening a.n. ...]", "brosur": ""}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('program', $isi${"unggulan": [{"ikon": "📖", "judul": "Tahfidzul Qur'an", "isi": "Halaqah hafalan harian dengan target [minimal 5 juz SMP / 10 juz SMA] dan setoran rutin kepada musyrifah."}, {"ikon": "🗣️", "judul": "Bahasa Arab", "isi": "Penguasaan bahasa Arab aktif untuk memahami Al-Qur'an, hadits, dan kitab para ulama."}, {"ikon": "🕌", "judul": "Praktik Ibadah", "isi": "Bimbingan langsung wudhu, shalat, dzikir, dan ibadah harian sesuai tuntunan sunnah."}, {"ikon": "📜", "judul": "Hafalan Hadits", "isi": "Menghafal hadits-hadits pilihan beserta penjelasan singkat dan pengamalannya."}], "keunggulan": [{"judul": "Kurikulum Terintegrasi.", "isi": "Kurikulum nasional dan kurikulum diniyah berjalan bersama dalam satu jadwal."}, {"judul": "Adab Sebelum Ilmu.", "isi": "Pembiasaan adab harian: salam, berbakti kepada orang tua, dan menghormati guru."}, {"judul": "Lingkungan Islami.", "isi": "Shalat berjamaah, dzikir pagi-petang, dan tilawah menjadi rutinitas setiap hari di asrama."}], "kurikulum": [{"ikon": "📖", "judul": "Tahfidzul Qur'an & Tahsin", "isi": "Santriwati dibimbing memperbaiki bacaan (tahsin) lalu menambah hafalan secara bertahap dengan metode talaqqi dan murajaah terjadwal. Ujian tasmi' diadakan setiap semester."}, {"ikon": "🗣️", "judul": "Bahasa Arab Aktif", "isi": "Pembelajaran nahwu, sharaf, dan percakapan sehari-hari, dilengkapi hari berbahasa Arab dan muhadharah."}, {"ikon": "📘", "judul": "Tafsir Ringkas", "isi": "Mengkaji makna ayat-ayat yang dihafal agar hafalan disertai pemahaman dan pengamalan."}, {"ikon": "📜", "judul": "Hafalan Hadits & Adab", "isi": "Hafalan hadits arbain dan hadits adab, dipraktikkan dalam keseharian di sekolah dan asrama."}, {"ikon": "🧪", "judul": "Kurikulum Nasional", "isi": "Mata pelajaran umum (Kurikulum Merdeka) tetap diajarkan lengkap sehingga lulusan siap melanjutkan ke jenjang berikutnya, negeri maupun swasta."}], "biaya_ringan": "Uang pangkal dapat dicicil [3 kali] dalam setahun. Tersedia beasiswa untuk santriwati berprestasi dan penghafal Al-Qur'an. [Sesuaikan]"}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('fasilitas', $isi${"fasilitas": [{"nama": "Masjid", "ikon": "🕌", "foto": ""}, {"nama": "Ruang Kelas Nyaman", "ikon": "🏫", "foto": ""}, {"nama": "Laboratorium Komputer", "ikon": "💻", "foto": ""}, {"nama": "Laboratorium IPA", "ikon": "🔬", "foto": ""}, {"nama": "Perpustakaan", "ikon": "📚", "foto": ""}, {"nama": "Asrama Putri", "ikon": "🛏️", "foto": ""}, {"nama": "Ruang Makan & Kantin", "ikon": "🍽️", "foto": ""}, {"nama": "UKS / Klinik", "ikon": "🩺", "foto": ""}], "ekstrakurikuler": [{"nama": "Panahan", "ikon": "🏹", "foto": ""}, {"nama": "Bela Diri", "ikon": "🥋", "foto": ""}, {"nama": "Tata Boga", "ikon": "🍳", "foto": ""}, {"nama": "Menjahit & Kriya", "ikon": "🧵", "foto": ""}, {"nama": "Pramuka", "ikon": "⛺", "foto": ""}, {"nama": "Muhadharah", "ikon": "🎤", "foto": ""}, {"nama": "Jurnalistik", "ikon": "✍️", "foto": ""}, {"nama": "KIR / Sains", "ikon": "🔬", "foto": ""}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('guru', $isi${"daftar": [{"nama": "[Nama Kepala SMP]", "jabatan": "Kepala SMP", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Kepala SMA]", "jabatan": "Kepala SMA", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Guru]", "jabatan": "Wakasek Kurikulum", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Guru]", "jabatan": "Wakasek Kesiswaan", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Ustadzah]", "jabatan": "Koordinator Tahfidz", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Guru]", "jabatan": "Guru Bahasa Arab", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Guru]", "jabatan": "Guru Matematika", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Guru]", "jabatan": "Guru Bahasa Inggris", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Guru]", "jabatan": "Guru IPA", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Guru]", "jabatan": "Guru Fiqih & Aqidah", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Guru]", "jabatan": "Guru Bahasa Indonesia", "kategori": "Guru", "foto": ""}, {"nama": "[Nama Ustadzah]", "jabatan": "Musyrifah Asrama", "kategori": "Tenaga Kependidikan", "foto": ""}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('struktur', $isi${"daftar": [{"jabatan": "Ketua Yayasan", "nama": "[Nama]", "foto": ""}, {"jabatan": "Kepala SMA", "nama": "Abdullah, S.H., M.H.", "foto": ""}, {"jabatan": "Kepala SMP", "nama": "[Nama]", "foto": ""}, {"jabatan": "Wakil Kepala Bidang Kurikulum", "nama": "[Nama]", "foto": ""}, {"jabatan": "Wakil Kepala Bidang Kesantriwatian", "nama": "[Nama]", "foto": ""}, {"jabatan": "Koordinator Tahfidz", "nama": "[Nama]", "foto": ""}, {"jabatan": "Kepala Asrama", "nama": "[Nama]", "foto": ""}, {"jabatan": "Tata Usaha", "nama": "[Nama]", "foto": ""}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('galeri', $isi${"daftar": [{"judul": "Shalat berjamaah", "kategori": "kegiatan", "ikon": "🕌", "foto": ""}, {"judul": "Halaqah tahfidz", "kategori": "kegiatan", "ikon": "📖", "foto": ""}, {"judul": "Juara MHQ", "kategori": "prestasi", "ikon": "🏆", "foto": ""}, {"judul": "Gedung sekolah", "kategori": "fasilitas", "ikon": "🏫", "foto": ""}, {"judul": "Persami Pramuka", "kategori": "kegiatan", "ikon": "⛺", "foto": ""}, {"judul": "Laboratorium IPA", "kategori": "fasilitas", "ikon": "🔬", "foto": ""}, {"judul": "Olimpiade sains", "kategori": "prestasi", "ikon": "🥇", "foto": ""}, {"judul": "Perpustakaan", "kategori": "fasilitas", "ikon": "📚", "foto": ""}, {"judul": "Ekskul tata boga", "kategori": "kegiatan", "ikon": "🍳", "foto": ""}, {"judul": "Muhadharah", "kategori": "kegiatan", "ikon": "🎤", "foto": ""}, {"judul": "Lomba pidato", "kategori": "prestasi", "ikon": "🎖️", "foto": ""}, {"judul": "Asrama putri", "kategori": "fasilitas", "ikon": "🛏️", "foto": ""}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('testimoni', $isi${"daftar": [{"nama": "[Nama Orang Tua]", "kategori": "Orang Tua", "keterangan": "Wali santriwati kelas VIII", "isi": "Alhamdulillah, sejak sekolah di sini putri kami semakin rajin shalat dan hafalannya terus bertambah. Ustadzahnya sabar dan perhatian. [Contoh testimoni, ganti dengan yang asli]", "foto": ""}, {"nama": "[Nama Orang Tua]", "kategori": "Orang Tua", "keterangan": "Wali santriwati kelas XI", "isi": "Kami senang karena pelajaran umum dan agama sama-sama diperhatikan. Putri kami jadi lebih mandiri dan sopan. [Contoh testimoni]", "foto": ""}, {"nama": "[Nama Alumni]", "kategori": "Alumni", "keterangan": "Alumni angkatan [I]", "isi": "Bekal hafalan dan bahasa Arab dari sekolah sangat membantu saya ketika melanjutkan kuliah. [Contoh testimoni]", "foto": ""}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('video', $isi${"daftar": [{"judul": "Profil Darul Marhamah Al-Qur'an Boarding School", "url": "https://www.youtube.com/watch?v=blhCKCdn8Ew"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('download', $isi${"daftar": [{"judul": "Kalender Akademik 2026/2027", "kategori": "Akademik", "file": ""}, {"judul": "Brosur PPDB 2027/2028", "kategori": "PPDB", "file": ""}, {"judul": "Logo Darul Marhamah ABS", "kategori": "Identitas", "file": "/assets/logo-512.png"}]}$isi$::jsonb) on conflict (kunci) do nothing;

insert into public.berita (judul, slug, tanggal, kategori, gambar, ringkasan, isi)
select * from (values
  ($isi$Tim Sains Lolos ke Olimpiade Sains Tingkat Provinsi$isi$, $isi$tim-sains-olimpiade-provinsi$isi$, '2026-10-10'::date, $isi$Prestasi$isi$, $isi$$isi$, $isi$[Contoh berita] Tiga santriwati mewakili sekolah pada OSN bidang Biologi, Kimia, dan Matematika.$isi$, $isi$<p>[Contoh berita] Tiga santriwati lolos mewakili sekolah pada Olimpiade Sains Nasional tingkat provinsi bidang Biologi, Kimia, dan Matematika.</p>$isi$),
  ($isi$Outing Class ke Museum dan Benteng Rotterdam$isi$, $isi$outing-class-benteng-rotterdam$isi$, '2026-10-18'::date, $isi$Kegiatan$isi$, $isi$$isi$, $isi$[Contoh berita] Belajar sejarah langsung di lapangan bersama wali kelas.$isi$, $isi$<p>[Contoh berita] Santriwati belajar sejarah Kota Makassar secara langsung di Benteng Rotterdam bersama wali kelas.</p>$isi$),
  ($isi$Penerimaan Santriwati Baru SMP & SMA 2027/2028 Dibuka$isi$, $isi$ppdb-2027-2028-dibuka$isi$, '2026-10-25'::date, $isi$PPDB$isi$, $isi$$isi$, $isi$[Contoh berita] Kuota terbatas. Segera daftarkan putri Anda melalui halaman Info PPDB.$isi$, $isi$<p>[Contoh berita] Pendaftaran santriwati baru jenjang SMP dan SMA tahun ajaran 2027/2028 telah dibuka. Informasi lengkap ada di halaman Info PPDB.</p>$isi$),
  ($isi$Penilaian Tengah Semester Ganjil Berjalan Lancar$isi$, $isi$penilaian-tengah-semester$isi$, '2026-11-01'::date, $isi$Akademik$isi$, $isi$$isi$, $isi$[Contoh berita] PTS semester ganjil tahun ajaran 2026/2027 dilaksanakan berbasis komputer.$isi$, $isi$<p>[Contoh berita] Penilaian Tengah Semester (PTS) ganjil tahun ajaran 2026/2027 telah dilaksanakan dengan tertib dan lancar.</p>$isi$),
  ($isi$Mabit dan Qiyamul Lail Bersama Seluruh Santriwati$isi$, $isi$mabit-dan-qiyamul-lail$isi$, '2026-11-08'::date, $isi$Kegiatan$isi$, $isi$$isi$, $isi$[Contoh berita] Malam bina iman dan takwa untuk memperkuat ruhiyah santriwati SMP dan SMA.$isi$, $isi$<p>[Contoh berita] Kegiatan malam bina iman dan takwa (mabit) diikuti seluruh santriwati SMP dan SMA, diisi dengan kajian, tilawah, dan qiyamul lail berjamaah.</p>$isi$),
  ($isi$Santriwati Raih Juara 1 Musabaqah Hifzhil Qur'an Tingkat Kota Makassar$isi$, $isi$juara-mhq-tingkat-kota-makassar$isi$, '2026-11-15'::date, $isi$Prestasi$isi$, $isi$$isi$, $isi$[Contoh berita] Ananda [Nama Santriwati] kelas XI meraih juara pertama MHQ kategori 10 juz.$isi$, $isi$<p>[Contoh berita] Alhamdulillah, Ananda [Nama Santriwati] dari kelas XI SMA IT Darul Marhamah ABS berhasil meraih juara pertama Musabaqah Hifzhil Qur'an kategori 10 juz tingkat Kota Makassar. Semoga menjadi motivasi bagi seluruh santriwati.</p><p>Silakan ganti isi berita ini melalui panel admin.</p>$isi$)
) as v(judul, slug, tanggal, kategori, gambar, ringkasan, isi)
where not exists (select 1 from public.berita);
