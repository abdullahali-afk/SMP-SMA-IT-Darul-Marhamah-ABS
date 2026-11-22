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
insert into public.konten (kunci, data) values ('menu', $isi${"daftar": [{"link": "/", "judul": "Beranda"}, {"sub": [{"link": "/profil.html#selayang", "judul": "Selayang Pandang"}, {"link": "/profil.html#visi-misi", "judul": "Visi & Misi"}, {"link": "/sekolah.html#program", "judul": "Program Unggulan"}, {"link": "/sekolah.html#fasilitas", "judul": "Fasilitas"}, {"link": "/struktur.html", "judul": "Struktur Organisasi"}, {"link": "/guru.html", "judul": "Guru & Staf"}, {"link": "/testimoni.html", "judul": "Testimoni"}], "link": "/profil.html", "judul": "Profil"}, {"sub": [{"link": "/sekolah.html#smp", "judul": "SMP IT Darul Marhamah ABS"}, {"link": "/sekolah.html#sma", "judul": "SMA IT Darul Marhamah ABS"}, {"link": "/sekolah.html#ekskul", "judul": "Ekstrakurikuler"}], "link": "/sekolah.html", "judul": "Sekolah"}, {"link": "/berita.html", "judul": "Berita"}, {"sub": [{"link": "/galeri.html", "judul": "Foto"}, {"link": "/galeri.html#video", "judul": "Video"}, {"link": "/download.html", "judul": "Download"}], "link": "/galeri.html", "judul": "Galeri"}, {"sub": [{"link": "/kontak.html", "judul": "Kontak & Lokasi"}, {"link": "/layanan.html", "judul": "Layanan & Call Center"}, {"link": "/layanan.html#rekening", "judul": "Rekening"}, {"link": "/layanan.html#saran", "judul": "Kritik & Saran"}], "link": "/kontak.html", "judul": "Kontak"}, {"sub": [{"link": "/ppdb.html#daftar", "judul": "Daftar Sekarang"}, {"link": "/ppdb.html#panduan", "judul": "Panduan Pendaftaran"}, {"link": "/ppdb.html#biaya", "judul": "Rincian Biaya"}], "link": "/ppdb.html", "judul": "Info PPDB", "tombol": true}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('sekolah', $isi${"sma": {"nama": "SMA Islam Terpadu Darul Marhamah Al-Qur'an Boarding School", "npsn": "70043438", "peta": "Jl. Perintis Kemerdekaan 3 BTN Asal Mula Blok E2/B Tamalanrea Indah Kota Makassar", "alamat": "Jl. Perintis Kemerdekaan III, BTN Asal Mula Blok E2 No. 7B, Kota Makassar", "akreditasi": "[A]", "kepala_sekolah": "Abdullah, S.H., M.H.", "target_hafalan": "[30 juz]"}, "smp": {"nama": "SMP Islam Terpadu Darul Marhamah Al-Qur'an Boarding School", "npsn": "70036850", "peta": "Jl. Sukamaju 3 No 66 Tamamaung Makassar", "alamat": "Jl. Sukamaju III No. 66, Kel. Tamamaung, Kota Makassar", "akreditasi": "[A]", "keterangan": "Untuk lulusan SD/MI (putri). Fokus pada tahsin, dasar hafalan, dan penguatan akhlak.", "kepala_sekolah": "[Nama Kepala SMP]", "target_hafalan": "[15 juz]"}, "misi": ["Melahirkan Muslimah yang Berkarakter dan Berakhlaq Qur'ani", "Melahirkan Muslimah Penghafal Al-Qur'an yang Mutqin", "Melahirkan Muslimah Da'iyah Pejuang Al-Qur'an", "Melahirkan Muslimah yang Peka dengan Lingkungan Sosialnya", "Melahirkan Muslimah yang Kreatif, Inovatif dan Pantang Menyerah", "Melahirkan Calon Ibu Pendidik Generasi Al-Qur'an"], "visi": "\"Menjadi sekolah model Al-Qur’an\"", "email": "darulmarhamah03@gmail.com", "slogan": "Karena Wanita adalah Rahim Peradaban", "sosmed": {"tiktok": "https://www.tiktok.com/@darul.marhamah.abs?lang=en", "youtube": "https://www.youtube.com/@marhamahtv6242", "facebook": "https://www.facebook.com/people/Darul-Marhamah-Al-Quran-Boarding-School-Makassar/100063824633527/", "instagram": "https://www.instagram.com/darulmarhamah_abs/"}, "sejarah": "Darul Marhamah Al-Qur'an Boarding School adalah sekolah berasrama khusus putri di Kota Makassar dengan jenjang SMP dan SMA. Berangkat dari keyakinan \"Karena Wanita adalah Rahim Peradaban\", kami mendidik santriwati agar menjadi muslimah yang cerdas, shalihah, dan kelak melahirkan generasi terbaik.\n\nDengan jenjang SMP dan SMA dalam satu lembaga, pembinaan santriwati dapat berlangsung berkesinambungan selama enam tahun. [Tambahkan sejarah singkat, tahun berdiri, dan nama yayasan.]", "telepon": "0852-1186-9470", "yayasan": "Yayasan Mutiara Alquran Alislamiyah", "whatsapp": "6285211869470", "deskripsi": "Boarding school putri di Kota Makassar yang membina muslimah penghafal Al-Qur'an, berakhlak mulia, dan unggul dalam ilmu.", "statistik": [{"angka": "[300]", "label": "Santriwati"}, {"angka": "[35]", "label": "Guru & Staf"}, {"angka": "[50]", "label": "Penghafal 10+ Juz"}, {"angka": "[100]", "label": "Prestasi"}], "jam_kantor": "Senin – Sabtu, 07.30 – 15.00 WITA", "nama_lengkap": "SMP & SMA Islam Terpadu Darul Marhamah Al-Qur'an Boarding School", "nama_singkat": "Darul Marhamah ABS", "tahun_berdiri": "2023"}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('program_pendidikan', $isi${"judul": "Visi & Misi Program Pendidikan", "pengantar": "Darul Marhamah menyelenggarakan dua program pendidikan. Setiap program memiliki visi dan misi sendiri, dan visi misi tersebut berlaku sama untuk jenjang SMP maupun SMA.", "daftar": [{"nama": "Program Takhassus", "nama_lengkap": "SMP-SMA IT Darul Marhamah Program Takhassus", "ikon": "📚", "jenjang": ["SMP", "SMA"], "ringkasan": "Program pendalaman ilmu syar'i dan bahasa Arab bagi santriwati yang disiapkan untuk melanjutkan studi Islam ke jenjang yang lebih tinggi, tetap disertai pembinaan hafalan Al-Qur'an.", "visi": "Menjadi program unggulan yang melahirkan muslimah berilmu syar'i, fasih berbahasa Arab, berakhlak Qur'ani, dan siap melanjutkan studi Islam ke jenjang yang lebih tinggi.", "misi": ["Menyelenggarakan pembelajaran dirasah islamiyah (akidah, fikih, hadis, tafsir, dan sirah) yang berlandaskan Al-Qur'an dan As-Sunnah.", "Membekali santriwati dengan kemampuan bahasa Arab aktif, lisan dan tulisan, sebagai kunci memahami sumber ajaran Islam.", "Membiasakan santriwati mengkaji kitab-kitab dasar karya para ulama secara bertahap dan terbimbing.", "Membina bacaan dan hafalan Al-Qur'an santriwati sesuai target program.", "Memadukan kurikulum nasional dan kurikulum kepesantrenan secara seimbang.", "Menanamkan adab, akhlak muslimah, dan semangat dakwah dalam kehidupan sehari-hari di asrama.", "Menyiapkan lulusan untuk melanjutkan studi ke perguruan tinggi Islam di dalam dan luar negeri."]}, {"nama": "Program Tahfizh", "nama_lengkap": "SMP-SMA IT Darul Marhamah Program Tahfizh", "ikon": "📖", "jenjang": ["SMP", "SMA"], "ringkasan": "Program pembinaan hafalan Al-Qur'an yang intensif dan terukur, dipadukan dengan pendidikan umum, bagi santriwati yang bercita-cita menjadi hafizhah.", "visi": "Menjadi program tahfizh unggulan yang melahirkan muslimah penghafal Al-Qur'an 30 juz yang mutqin, berakhlak Qur'ani, dan berprestasi akademik.", "misi": ["Menyelenggarakan pembinaan hafalan Al-Qur'an harian yang terprogram melalui setoran, murajaah, dan ujian hafalan berkala.", "Memperbaiki bacaan santriwati melalui tahsin dan pembelajaran ilmu tajwid.", "Menjaga mutu hafalan (itqan) dengan murajaah terjadwal dan pendampingan muhaffizhah.", "Menumbuhkan kecintaan pada Al-Qur'an melalui pemahaman makna dan tadabbur ayat.", "Memadukan program tahfizh dengan kurikulum nasional agar santriwati tetap berprestasi akademik.", "Menyiapkan lulusan yang mampu mengajarkan Al-Qur'an di keluarga dan masyarakat."]}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('beranda', $isi${"hero": [{"sub": "SMP & SMA Islam Terpadu khusus putri di Kota Makassar. Karena Wanita adalah Rahim Peradaban.", "foto": "", "link": "/ppdb.html", "judul": "Selamat Datang di Darul Marhamah Al-Qur'an Boarding School", "tombol": "MENJADI BAGIAN", "judul_arab": "أَهْلًا وَسَهْلًا بِكُمْ فِي دَارِ الْمَرْحَمَة"}, {"sub": "Program tahfidz terbimbing, bahasa Arab aktif, dan pembinaan adab di lingkungan asrama yang aman.", "foto": "", "link": "/ppdb.html", "judul": "Mencetak Muslimah Penghafal Al-Qur'an", "tombol": "INFO PPDB", "judul_arab": "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ"}], "mitra": [], "alasan": {"foto": "", "daftar": [{"isi": "Target hafalan terukur dengan setoran harian dan ujian tasmi' berkala.", "judul": "Fokus Al-Qur'an"}, {"isi": "Bahasa Arab menjadi bekal memahami Al-Qur'an, hadits, dan kitab para ulama.", "judul": "Bahasa Arab Aktif"}, {"isi": "Adab islami dibiasakan setiap hari bersama ustadzah dan musyrifah.", "judul": "Pembinaan Karakter"}, {"isi": "Lingkungan khusus putri yang terjaga, nyaman, dan diawasi 24 jam.", "judul": "Asrama Putri yang Aman"}, {"isi": "Kurikulum nasional tetap utuh sehingga lulusan siap ke jenjang berikutnya.", "judul": "Kurikulum Lengkap"}]}, "alumni": {"link": "/testimoni.html", "teks": "Alumni Darul Marhamah diharapkan menjadi muslimah yang berperan di keluarga dan masyarakat: sebagai pendidik, penghafal Al-Qur'an, dan da'iyah. [Tambahkan kisah alumni.]", "judul": "Kontribusi dan Kiprah Alumni"}, "tautan": [{"isi": "Mengenal sejarah, visi misi, dan lembaga yang menaungi sekolah.", "ikon": "🏫", "link": "/profil.html", "judul": "Tentang Darul Marhamah"}, {"isi": "Keseharian santriwati: ibadah berjamaah, halaqah tahfidz, dan kegiatan asrama.", "ikon": "🌙", "link": "/galeri.html", "judul": "Kehidupan Asrama"}, {"isi": "Alasan orang tua mempercayakan pendidikan putrinya kepada kami.", "ikon": "⭐", "link": "/#alasan", "judul": "Mengapa Memilih Kami"}, {"isi": "Peluang kerja sama dengan orang tua, alumni, lembaga, dan masyarakat.", "ikon": "🤝", "link": "/layanan.html", "judul": "Ruang Kolaborasi"}], "capaian": {"teks": "Sejak berdiri pada tahun 2023, Darul Marhamah Al-Qur'an Boarding School terus berkembang dalam membina muslimah penghafal Al-Qur'an di Kota Makassar. [Sesuaikan teks capaian sekolah.]", "judul": "Capaian Kami"}, "layanan": [{"link": "/kontak.html", "nama": "Layanan Akademik"}, {"link": "/kontak.html", "nama": "Layanan Asrama"}, {"link": "/kontak.html", "nama": "Administrasi / Tata Usaha"}, {"link": "/layanan.html#rekening", "nama": "Keuangan & Rekening"}, {"link": "/kontak.html", "nama": "Media dan Humas"}], "foto_visi": "", "call_center": [{"nomor": "0852-1186-9470", "bagian": "Akademik"}, {"nomor": "0852-1186-9470", "bagian": "Keuangan"}, {"nomor": "0852-1186-9470", "bagian": "Keasramaan"}, {"nomor": "0852-1186-9470", "bagian": "Kesantriwatian"}, {"nomor": "0852-1186-9470", "bagian": "PPDB"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('ppdb', $isi${"alur": [{"isi": "Isi formulir di halaman ini atau datang langsung ke sekolah.", "judul": "Isi Formulir"}, {"isi": "Transfer biaya pendaftaran ke rekening sekolah (lihat di bawah).", "judul": "Bayar Pendaftaran"}, {"isi": "Tes akademik, baca Al-Qur'an, hafalan, dan wawancara calon santriwati & orang tua.", "judul": "Tes Seleksi"}, {"isi": "Hasil seleksi diumumkan melalui WhatsApp.", "judul": "Pengumuman"}, {"isi": "Melengkapi administrasi dan berkas untuk menjadi santriwati resmi.", "judul": "Daftar Ulang"}], "biaya": [{"sma": "Rp [000.000]", "smp": "Rp [000.000]", "komponen": "Pendaftaran"}, {"sma": "Rp [0.000.000]", "smp": "Rp [0.000.000]", "komponen": "Uang pangkal (bisa dicicil)"}, {"sma": "Rp [000.000]", "smp": "Rp [000.000]", "komponen": "Asrama & makan per bulan"}, {"sma": "Rp [0.000.000]", "smp": "Rp [0.000.000]", "komponen": "Seragam & perlengkapan"}, {"sma": "Rp [000.000]", "smp": "Rp [000.000]", "komponen": "SPP per bulan"}], "brosur": "", "status": "Pendaftaran dibuka", "syarat": ["Calon santriwati (perempuan)", "SMP: lulusan SD/MI sederajat", "SMA: lulusan SMP/MTs sederajat", "Bersedia tinggal di asrama", "Fotokopi ijazah/SKL dan rapor terakhir", "Fotokopi Akta Kelahiran & Kartu Keluarga", "Pas foto 3×4 (4 lembar)", "Mampu membaca Al-Qur'an"], "rekening": "[Nama Bank – No. Rekening a.n. ...]", "gelombang": [{"nama": "Gelombang 1", "waktu": "[1 November – 31 Desember 2026]"}, {"nama": "Gelombang 2", "waktu": "[1 Januari – 28 Februari 2027]"}, {"nama": "Gelombang 3", "waktu": "[1 Maret – 30 April 2027]"}], "tahun_ajaran": "2027/2028", "catatan_biaya": "*Tersedia beasiswa untuk santriwati berprestasi dan penghafal Al-Qur'an. [Sesuaikan]"}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('program', $isi${"unggulan": [{"isi": "Halaqah hafalan harian dengan target [minimal 5 juz SMP / 10 juz SMA] dan setoran rutin kepada musyrifah.", "ikon": "📖", "judul": "Tahfidzul Qur'an"}, {"isi": "Penguasaan bahasa Arab aktif untuk memahami Al-Qur'an, hadits, dan kitab para ulama.", "ikon": "🗣️", "judul": "Bahasa Arab"}, {"isi": "Bimbingan langsung wudhu, shalat, dzikir, dan ibadah harian sesuai tuntunan sunnah.", "ikon": "🕌", "judul": "Praktik Ibadah"}, {"isi": "Menghafal hadits-hadits pilihan beserta penjelasan singkat dan pengamalannya.", "ikon": "📜", "judul": "Hafalan Hadits"}], "kurikulum": [{"isi": "Santriwati dibimbing memperbaiki bacaan (tahsin) lalu menambah hafalan secara bertahap dengan metode talaqqi dan murajaah terjadwal. Ujian tasmi' diadakan setiap semester.", "ikon": "📖", "judul": "Tahfidzul Qur'an & Tahsin"}, {"isi": "Pembelajaran nahwu, sharaf, dan percakapan sehari-hari, dilengkapi hari berbahasa Arab dan muhadharah.", "ikon": "🗣️", "judul": "Bahasa Arab Aktif"}, {"isi": "Mengkaji makna ayat-ayat yang dihafal agar hafalan disertai pemahaman dan pengamalan.", "ikon": "📘", "judul": "Tafsir Ringkas"}, {"isi": "Hafalan hadits arbain dan hadits adab, dipraktikkan dalam keseharian di sekolah dan asrama.", "ikon": "📜", "judul": "Hafalan Hadits & Adab"}, {"isi": "Mata pelajaran umum (Kurikulum Merdeka) tetap diajarkan lengkap sehingga lulusan siap melanjutkan ke jenjang berikutnya, negeri maupun swasta.", "ikon": "🧪", "judul": "Kurikulum Nasional"}], "keunggulan": [{"isi": "Kurikulum nasional dan kurikulum diniyah berjalan bersama dalam satu jadwal.", "judul": "Kurikulum Terintegrasi."}, {"isi": "Pembiasaan adab harian: salam, berbakti kepada orang tua, dan menghormati guru.", "judul": "Adab Sebelum Ilmu."}, {"isi": "Shalat berjamaah, dzikir pagi-petang, dan tilawah menjadi rutinitas setiap hari di asrama.", "judul": "Lingkungan Islami."}], "biaya_ringan": "Uang pangkal dapat dicicil [3 kali] dalam setahun. Tersedia beasiswa untuk santriwati berprestasi dan penghafal Al-Qur'an. [Sesuaikan]"}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('fasilitas', $isi${"fasilitas": [{"foto": "", "ikon": "🕌", "nama": "Masjid"}, {"foto": "", "ikon": "🏫", "nama": "Ruang Kelas Nyaman"}, {"foto": "", "ikon": "💻", "nama": "Laboratorium Komputer"}, {"foto": "", "ikon": "🔬", "nama": "Laboratorium IPA"}, {"foto": "", "ikon": "📚", "nama": "Perpustakaan"}, {"foto": "", "ikon": "🛏️", "nama": "Asrama Putri"}, {"foto": "", "ikon": "🍽️", "nama": "Ruang Makan & Kantin"}, {"foto": "", "ikon": "🩺", "nama": "UKS / Klinik"}], "ekstrakurikuler": [{"foto": "", "ikon": "🏹", "nama": "Panahan"}, {"foto": "", "ikon": "🥋", "nama": "Bela Diri"}, {"foto": "", "ikon": "🍳", "nama": "Tata Boga"}, {"foto": "", "ikon": "🧵", "nama": "Menjahit & Kriya"}, {"foto": "", "ikon": "⛺", "nama": "Pramuka"}, {"foto": "", "ikon": "🎤", "nama": "Muhadharah"}, {"foto": "", "ikon": "✍️", "nama": "Jurnalistik"}, {"foto": "", "ikon": "🔬", "nama": "KIR / Sains"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('guru', $isi${"daftar": [{"foto": "", "nama": "[Nama Kepala SMP]", "jabatan": "Kepala SMP", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Kepala SMA]", "jabatan": "Kepala SMA", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Wakasek Kurikulum", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Wakasek Kesiswaan", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Ustadzah]", "jabatan": "Koordinator Tahfidz", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Bahasa Arab", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Matematika", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Bahasa Inggris", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru IPA", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Fiqih & Aqidah", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Bahasa Indonesia", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Ustadzah]", "jabatan": "Musyrifah Asrama", "kategori": "Tenaga Kependidikan"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('struktur', $isi${"daftar": [{"foto": "", "nama": "[Nama]", "jabatan": "Ketua Yayasan"}, {"foto": "", "nama": "Abdullah, S.H., M.H.", "jabatan": "Kepala SMA"}, {"foto": "", "nama": "[Nama]", "jabatan": "Kepala SMP"}, {"foto": "", "nama": "[Nama]", "jabatan": "Wakil Kepala Bidang Kurikulum"}, {"foto": "", "nama": "[Nama]", "jabatan": "Wakil Kepala Bidang Kesantriwatian"}, {"foto": "", "nama": "[Nama]", "jabatan": "Koordinator Tahfidz"}, {"foto": "", "nama": "[Nama]", "jabatan": "Kepala Asrama"}, {"foto": "", "nama": "[Nama]", "jabatan": "Tata Usaha"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('galeri', $isi${"daftar": [{"foto": "", "ikon": "🕌", "judul": "Shalat berjamaah", "kategori": "kegiatan"}, {"foto": "", "ikon": "📖", "judul": "Halaqah tahfidz", "kategori": "kegiatan"}, {"foto": "", "ikon": "🏆", "judul": "Juara MHQ", "kategori": "prestasi"}, {"foto": "", "ikon": "🏫", "judul": "Gedung sekolah", "kategori": "fasilitas"}, {"foto": "", "ikon": "⛺", "judul": "Persami Pramuka", "kategori": "kegiatan"}, {"foto": "", "ikon": "🔬", "judul": "Laboratorium IPA", "kategori": "fasilitas"}, {"foto": "", "ikon": "🥇", "judul": "Olimpiade sains", "kategori": "prestasi"}, {"foto": "", "ikon": "📚", "judul": "Perpustakaan", "kategori": "fasilitas"}, {"foto": "", "ikon": "🍳", "judul": "Ekskul tata boga", "kategori": "kegiatan"}, {"foto": "", "ikon": "🎤", "judul": "Muhadharah", "kategori": "kegiatan"}, {"foto": "", "ikon": "🎖️", "judul": "Lomba pidato", "kategori": "prestasi"}, {"foto": "", "ikon": "🛏️", "judul": "Asrama putri", "kategori": "fasilitas"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('testimoni', $isi${"daftar": [{"isi": "Alhamdulillah, sejak sekolah di sini putri kami semakin rajin shalat dan hafalannya terus bertambah. Ustadzahnya sabar dan perhatian. [Contoh testimoni, ganti dengan yang asli]", "foto": "", "nama": "[Nama Orang Tua]", "kategori": "Orang Tua", "keterangan": "Wali santriwati kelas VIII"}, {"isi": "Kami senang karena pelajaran umum dan agama sama-sama diperhatikan. Putri kami jadi lebih mandiri dan sopan. [Contoh testimoni]", "foto": "", "nama": "[Nama Orang Tua]", "kategori": "Orang Tua", "keterangan": "Wali santriwati kelas XI"}, {"isi": "Bekal hafalan dan bahasa Arab dari sekolah sangat membantu saya ketika melanjutkan kuliah. [Contoh testimoni]", "foto": "", "nama": "[Nama Alumni]", "kategori": "Alumni", "keterangan": "Alumni angkatan [I]"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('video', $isi${"daftar": [{"url": "https://www.youtube.com/watch?v=blhCKCdn8Ew", "judul": "Profil Darul Marhamah Al-Qur'an Boarding School"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('download', $isi${"daftar": [{"file": "", "judul": "Kalender Akademik 2026/2027", "kategori": "Akademik"}, {"file": "", "judul": "Brosur PPDB 2027/2028", "kategori": "PPDB"}, {"file": "/assets/logo-512.png", "judul": "Logo Darul Marhamah ABS", "kategori": "Identitas"}]}$isi$::jsonb) on conflict (kunci) do nothing;

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
