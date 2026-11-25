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
-- Akun calon santri (PPDB online, lihat ppdb-online.sql) masuk ke tabel pendaftar.
create or replace function public.buat_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'jenis', '') = 'pendaftar' then
    insert into public.pendaftar (id, email, nama, no_wa)
    values (new.id, new.email, left(coalesce(new.raw_user_meta_data->>'nama', ''), 120),
            left(coalesce(new.raw_user_meta_data->>'no_wa', ''), 30))
    on conflict (id) do nothing;
    return new;
  end if;
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
insert into public.konten (kunci, data) values ('menu', $isi${"daftar": [{"link": "/", "judul": "Beranda"}, {"sub": [{"link": "/profil.html#selayang", "judul": "Selayang Pandang"}, {"link": "/profil.html#visi-misi", "judul": "Visi & Misi"}, {"link": "/sekolah.html#program", "judul": "Program Unggulan"}, {"link": "/sekolah.html#fasilitas", "judul": "Fasilitas"}, {"link": "/struktur.html", "judul": "Struktur Organisasi"}, {"link": "/guru.html", "judul": "Guru & Staf"}, {"link": "/testimoni.html", "judul": "Testimoni"}], "link": "/profil.html", "judul": "Profil"}, {"sub": [{"link": "/program-tahfizh.html", "judul": "Program Tahfizh (Sukamaju)"}, {"link": "/program-takhassus.html", "judul": "Program Takhassus (Asal Mula)"}, {"link": "/sekolah.html#smp", "judul": "SMP IT Darul Marhamah ABS"}, {"link": "/sekolah.html#sma", "judul": "SMA IT Darul Marhamah ABS"}, {"link": "/sekolah.html#ekskul", "judul": "Ekstrakurikuler"}], "link": "/sekolah.html", "judul": "Sekolah"}, {"link": "/berita.html", "judul": "Berita"}, {"sub": [{"link": "/galeri.html", "judul": "Foto"}, {"link": "/galeri.html#video", "judul": "Video"}, {"link": "/download.html", "judul": "Download"}], "link": "/galeri.html", "judul": "Galeri"}, {"sub": [{"link": "/kontak.html", "judul": "Kontak & Lokasi"}, {"link": "/layanan.html", "judul": "Layanan & Call Center"}, {"link": "/layanan.html#rekening", "judul": "Rekening"}, {"link": "/layanan.html#saran", "judul": "Kritik & Saran"}], "link": "/kontak.html", "judul": "Kontak"}, {"sub": [{"link": "/ppdb.html#daftar", "judul": "Daftar Sekarang"}, {"link": "/ppdb.html#panduan", "judul": "Panduan Pendaftaran"}, {"link": "/ppdb.html#biaya", "judul": "Rincian Biaya"}], "link": "/ppdb.html", "judul": "Info PPDB", "tombol": true}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('sekolah', $isi${"sma": {"nama": "SMA Islam Terpadu Darul Marhamah Al-Qur'an Boarding School", "npsn": "70043438", "peta": "https://www.google.com/maps/place/Darul+Marhamah+Al-Qur'an+Boarding+School/@-5.1361374,119.4410803,14z/data=!4m10!1m2!2m1!1smaps+sma+it+darul+marhamah!3m6!1s0x2dbefccf239723b1:0x506f0efcb8f1fbf3!8m2!3d-5.132229!4d119.480484!15sChptYXBzIHNtYSBpdCBkYXJ1bCBtYXJoYW1haFocIhptYXBzIHNtYSBpdCBkYXJ1bCBtYXJoYW1haJIBEHJlbGlnaW91c19zY2hvb2zgAQA!16s%2Fg%2F11c0wd1pq0?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D", "alamat": "Jl. Perintis Kemerdekaan III, BTN Asal Mula Blok E2 No. 7B, Kota Makassar", "akreditasi": "[A]", "keterangan": "", "kepala_sekolah": "Abdullah, S.H., M.H.", "target_hafalan": "[30 juz]", "peta_embed": "https://www.google.com/maps?output=embed&z=17&q=-5.132229%2C119.480484", "peta_link": "https://www.google.com/maps/place/Darul+Marhamah+Al-Qur'an+Boarding+School/@-5.1361374,119.4410803,14z/data=!4m10!1m2!2m1!1smaps+sma+it+darul+marhamah!3m6!1s0x2dbefccf239723b1:0x506f0efcb8f1fbf3!8m2!3d-5.132229!4d119.480484!15sChptYXBzIHNtYSBpdCBkYXJ1bCBtYXJoYW1haFocIhptYXBzIHNtYSBpdCBkYXJ1bCBtYXJoYW1haJIBEHJlbGlnaW91c19zY2hvb2zgAQA!16s%2Fg%2F11c0wd1pq0?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D"}, "smp": {"nama": "SMP Islam Terpadu Darul Marhamah Al-Qur'an Boarding School", "npsn": "70036850", "peta": "https://www.google.com/maps/place/Pondok+Al-Qur'an+Darul+Marhamah+SukaMaju/@-5.139969,119.4428813,18z/data=!4m14!1m7!3m6!1s0x2dbefdac5a1054b9:0x4d546915ee269ca3!2sPondok+Al-Qur'an+Darul+Marhamah+SukaMaju!8m2!3d-5.1400465!4d119.4428759!16s%2Fg%2F11h4nrmmkt!3m5!1s0x2dbefdac5a1054b9:0x4d546915ee269ca3!8m2!3d-5.1400465!4d119.4428759!16s%2Fg%2F11h4nrmmkt?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D", "alamat": "Jl. Sukamaju III No. 66, Kel. Tamamaung, Kota Makassar", "akreditasi": "[A]", "keterangan": "Untuk lulusan SD/MI (putri). Fokus pada tahsin, dasar hafalan, dan penguatan akhlak.", "kepala_sekolah": "Nur Wahdaniyah, S.S., M.Hum.", "target_hafalan": "[15 juz]", "peta_embed": "https://www.google.com/maps?output=embed&z=17&q=-5.1400465%2C119.4428759", "peta_link": "https://www.google.com/maps/place/Pondok+Al-Qur'an+Darul+Marhamah+SukaMaju/@-5.139969,119.4428813,18z/data=!4m14!1m7!3m6!1s0x2dbefdac5a1054b9:0x4d546915ee269ca3!2sPondok+Al-Qur'an+Darul+Marhamah+SukaMaju!8m2!3d-5.1400465!4d119.4428759!16s%2Fg%2F11h4nrmmkt!3m5!1s0x2dbefdac5a1054b9:0x4d546915ee269ca3!8m2!3d-5.1400465!4d119.4428759!16s%2Fg%2F11h4nrmmkt?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D"}, "misi": ["Melahirkan Muslimah yang Berkarakter dan Berakhlaq Qur'ani", "Melahirkan Muslimah Penghafal Al-Qur'an yang Mutqin", "Melahirkan Muslimah Da'iyah Pejuang Al-Qur'an", "Melahirkan Muslimah yang Peka dengan Lingkungan Sosialnya", "Melahirkan Muslimah yang Kreatif, Inovatif dan Pantang Menyerah", "Melahirkan Calon Ibu Pendidik Generasi Al-Qur'an"], "visi": "\"Menjadi sekolah model Al-Qur’an\"", "email": "darulmarhamah03@gmail.com", "slogan": "Karena Wanita adalah Rahim Peradaban", "sosmed": {"tiktok": "https://www.tiktok.com/@darul.marhamah.abs?lang=en", "youtube": "https://www.youtube.com/@marhamahtv6242", "facebook": "https://www.facebook.com/people/Darul-Marhamah-Al-Quran-Boarding-School-Makassar/100063824633527/", "instagram": "https://www.instagram.com/darulmarhamah_abs/"}, "sejarah": "Darul Marhamah Al-Qur'an Boarding School adalah sekolah berasrama khusus putri di Kota Makassar dengan jenjang SMP dan SMA. Berangkat dari keyakinan \"Karena Wanita adalah Rahim Peradaban\", kami mendidik santriwati agar menjadi muslimah yang cerdas, shalihah, dan kelak melahirkan generasi terbaik.\n\nDengan jenjang SMP dan SMA dalam satu lembaga, pembinaan santriwati dapat berlangsung berkesinambungan selama enam tahun. [Tambahkan sejarah singkat, tahun berdiri, dan nama yayasan.]", "telepon": "0851472433830", "yayasan": "Yayasan Mutiara Alquran Alislamiyah", "whatsapp": "6285211869470", "deskripsi": "Boarding school putri di Kota Makassar yang membina muslimah penghafal Al-Qur'an, berakhlak mulia, dan unggul dalam ilmu.", "kontak_wa": [{"nama": "Wakil Direktur", "nomor": "085211869470"}], "statistik": [{"angka": "[300]", "label": "Santriwati"}, {"angka": "[35]", "label": "Guru & Staf"}, {"angka": "[50]", "label": "Penghafal 10+ Juz"}, {"angka": "[100]", "label": "Prestasi"}], "jam_kantor": "Senin – Sabtu, 07.30 – 15.00 WITA", "foto_sekolah": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/sekolah/1795391205458-screenshot-2026-11-23-074625.jpg", "nama_lengkap": "SMP & SMA Islam Terpadu Darul Marhamah Al-Qur'an Boarding School", "nama_singkat": "Darul Marhamah ABS", "tahun_berdiri": "2023"}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('program_pendidikan', $isi${"judul": "Visi & Misi Program Pendidikan", "daftar": [{"foto": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/program_pendidikan/1795555920945-pvem-screenshot-2026-11-23-074625.jpg", "ikon": "📚", "misi": ["Melahirkan Muslimah yang Berkarakter dan Berakhlaq Qur'ani", "Melahirkan Muslimah Penghafal Al-Qur'an yang Mutqin", "Melahirkan Muslimah Da'iyah Pejuang Al-Qur'an", "Melahirkan Muslimah yang Peka dengan Lingkungan Sosialnya", "Melahirkan Muslimah yang Kreatif, Inovatif dan Pantang Menyerah", "Melahirkan Calon Ibu Pendidik Generasi Al-Qur'an"], "nama": "Program Takhassus", "peta": "https://www.google.com/maps/place/Darul+Marhamah+Al-Qur'an+Boarding+School/@-5.1361374,119.4410803,14z/data=!4m10!1m2!2m1!1smaps+sma+it+darul+marhamah!3m6!1s0x2dbefccf239723b1:0x506f0efcb8f1fbf3!8m2!3d-5.132229!4d119.480484!15sChptYXBzIHNtYSBpdCBkYXJ1bCBtYXJoYW1haFocIhptYXBzIHNtYSBpdCBkYXJ1bCBtYXJoYW1haJIBEHJlbGlnaW91c19zY2hvb2zgAQA!16s%2Fg%2F11c0wd1pq0?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D", "visi": "\"Menjadi sekolah model Al-Qur’an\"", "alamat": "Jl. Perintis Kemerdekaan III, BTN Asal Mula Blok E2 No. 7B, Kota Makassar", "kampus": "Kampus Asal Mula", "jenjang": ["SMP", "SMA"], "ringkasan": "Program pendalaman ilmu syar'i dan bahasa Arab bagi santriwati yang disiapkan untuk melanjutkan studi Islam ke jenjang yang lebih tinggi, tetap disertai pembinaan hafalan Al-Qur'an.", "nama_lengkap": "SMP-SMA IT Darul Marhamah Program Takhassus", "peta_embed": "https://www.google.com/maps?output=embed&z=17&q=-5.132229%2C119.480484", "peta_link": "https://www.google.com/maps/place/Darul+Marhamah+Al-Qur'an+Boarding+School/@-5.1361374,119.4410803,14z/data=!4m10!1m2!2m1!1smaps+sma+it+darul+marhamah!3m6!1s0x2dbefccf239723b1:0x506f0efcb8f1fbf3!8m2!3d-5.132229!4d119.480484!15sChptYXBzIHNtYSBpdCBkYXJ1bCBtYXJoYW1haFocIhptYXBzIHNtYSBpdCBkYXJ1bCBtYXJoYW1haJIBEHJlbGlnaW91c19zY2hvb2zgAQA!16s%2Fg%2F11c0wd1pq0?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D"}, {"foto": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/program_pendidikan/1795556031622-ev31-screenshot-2026-11-25-053339.png", "ikon": "📖", "misi": ["Pembentukan Pribadi santri yg cerdas dan berkarakter seorang mukminah yang memiliki kesungguhan, kepedulian dan berjiwa gotong royong", "Sistem pengelolaan pendidikan yang memadukan target pencapaian hafalan AL-Qur'an 15 juz dengan penguasaan materi pelajaran yang sempurna", "Sistem pendidikan dan pengajaran yang menghasilkan luaran dengan kualifikasi: Hafal, paham dan aplikatif", "Menciptakan suasana lingkungan pendidikan yang kondusif, nyaman dan berkarakter", "Pengawasan terhadap sistem pendidikan dan pengajaran untuk mencapai mutu sekolah yang unggul dan berkarakter", "Kehadiran para guru dan pembina yang memiliki karakter pendidik dan pengasuh"], "nama": "Program Tahfizh", "peta": "https://www.google.com/maps/place/Pondok+Al-Qur'an+Darul+Marhamah+SukaMaju/@-5.139969,119.4428813,18z/data=!4m14!1m7!3m6!1s0x2dbefdac5a1054b9:0x4d546915ee269ca3!2sPondok+Al-Qur'an+Darul+Marhamah+SukaMaju!8m2!3d-5.1400465!4d119.4428759!16s%2Fg%2F11h4nrmmkt!3m5!1s0x2dbefdac5a1054b9:0x4d546915ee269ca3!8m2!3d-5.1400465!4d119.4428759!16s%2Fg%2F11h4nrmmkt?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D", "visi": "Menjadi sekolah unggul yang berkarakter Alqur'an", "alamat": "Jl. Sukamaju III No. 66, Kel. Tamamaung, Kota Makassar", "kampus": "Kampus Sukamaju", "jenjang": ["SMP", "SMA"], "ringkasan": "Program pembinaan hafalan Al-Qur'an yang intensif dan terukur, dipadukan dengan pendidikan umum, bagi santriwati yang bercita-cita menjadi hafizhah.", "nama_lengkap": "SMP-SMA IT Darul Marhamah Program Tahfizh", "peta_embed": "https://www.google.com/maps?output=embed&z=17&q=-5.1400465%2C119.4428759", "peta_link": "https://www.google.com/maps/place/Pondok+Al-Qur'an+Darul+Marhamah+SukaMaju/@-5.139969,119.4428813,18z/data=!4m14!1m7!3m6!1s0x2dbefdac5a1054b9:0x4d546915ee269ca3!2sPondok+Al-Qur'an+Darul+Marhamah+SukaMaju!8m2!3d-5.1400465!4d119.4428759!16s%2Fg%2F11h4nrmmkt!3m5!1s0x2dbefdac5a1054b9:0x4d546915ee269ca3!8m2!3d-5.1400465!4d119.4428759!16s%2Fg%2F11h4nrmmkt?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D"}], "pengantar": "Darul Marhamah menyelenggarakan dua program pendidikan. Setiap program memiliki visi dan misi sendiri, dan visi misi tersebut berlaku sama untuk jenjang SMP maupun SMA."}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('beranda', $isi${"hero": [{"sub": "SMP & SMA Islam Terpadu khusus putri di Kota Makassar. Karena Wanita adalah Rahim Peradaban.", "foto": "", "link": "/ppdb.html", "judul": "Selamat Datang di Darul Marhamah Al-Qur'an Boarding School", "tombol": "MENJADI BAGIAN", "judul_arab": "أَهْلًا وَسَهْلًا بِكُمْ فِي دَارِ الْمَرْحَمَة"}, {"sub": "Program tahfidz terbimbing, bahasa Arab aktif, dan pembinaan adab di lingkungan asrama yang aman.", "foto": "", "link": "/ppdb.html", "judul": "Mencetak Muslimah Penghafal Al-Qur'an", "tombol": "INFO PPDB", "judul_arab": "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ"}], "mitra": [], "alasan": {"foto": "", "daftar": [{"isi": "Target hafalan terukur dengan setoran harian dan ujian tasmi' berkala.", "judul": "Fokus Al-Qur'an"}, {"isi": "Bahasa Arab menjadi bekal memahami Al-Qur'an, hadits, dan kitab para ulama.", "judul": "Bahasa Arab Aktif"}, {"isi": "Adab islami dibiasakan setiap hari bersama ustadzah dan musyrifah.", "judul": "Pembinaan Karakter"}, {"isi": "Lingkungan khusus putri yang terjaga, nyaman, dan diawasi 24 jam.", "judul": "Asrama Putri yang Aman"}, {"isi": "Kurikulum nasional tetap utuh sehingga lulusan siap ke jenjang berikutnya.", "judul": "Kurikulum Lengkap"}]}, "alumni": {"link": "/testimoni.html", "teks": "Alumni Darul Marhamah diharapkan menjadi muslimah yang berperan di keluarga dan masyarakat: sebagai pendidik, penghafal Al-Qur'an, dan da'iyah.", "judul": "Kontribusi dan Kiprah Alumni"}, "tautan": [{"isi": "Mengenal sejarah, visi misi, dan lembaga yang menaungi sekolah.", "ikon": "🏫", "link": "/profil.html", "judul": "Tentang Darul Marhamah"}, {"isi": "Keseharian santriwati: ibadah berjamaah, halaqah tahfidz, dan kegiatan asrama.", "ikon": "🌙", "link": "/galeri.html", "judul": "Kehidupan Asrama"}, {"isi": "Alasan orang tua mempercayakan pendidikan putrinya kepada kami.", "ikon": "⭐", "link": "/#alasan", "judul": "Mengapa Memilih Kami"}, {"isi": "Peluang kerja sama dengan orang tua, alumni, lembaga, dan masyarakat.", "ikon": "🤝", "link": "/layanan.html", "judul": "Ruang Kolaborasi"}], "capaian": {"teks": "Sejak berdiri pada tahun 2023, Darul Marhamah Al-Qur'an Boarding School terus berkembang dalam membina muslimah penghafal Al-Qur'an di Kota Makassar.", "judul": "Capaian Kami"}, "layanan": [{"link": "/kontak.html", "nama": "Layanan Akademik"}, {"link": "/kontak.html", "nama": "Layanan Asrama"}, {"link": "/kontak.html", "nama": "Administrasi / Tata Usaha"}, {"link": "/layanan.html#rekening", "nama": "Keuangan & Rekening"}, {"link": "/kontak.html", "nama": "Media dan Humas"}], "foto_visi": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/beranda/1795425511375-screenshot-2026-11-14-114209.png", "call_center": [{"nomor": "082386333048", "bagian": "Akademik"}, {"nomor": "085343503788", "bagian": "Akunting"}, {"nomor": "082347726686", "bagian": "Kesantrian"}, {"nomor": "085194587206", "bagian": "Umum"}, {"nomor": "085147243830", "bagian": "PPDB"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('ppdb', $isi${"alur": [{"isi": "Isi formulir di halaman ini atau datang langsung ke sekolah.", "judul": "Isi Formulir"}, {"isi": "Transfer biaya pendaftaran ke rekening sekolah (lihat di bawah).", "judul": "Bayar Pendaftaran"}, {"isi": "Tes akademik, baca Al-Qur'an, hafalan, dan wawancara calon santriwati & orang tua.", "judul": "Tes Seleksi"}, {"isi": "Hasil seleksi diumumkan melalui WhatsApp.", "judul": "Pengumuman"}, {"isi": "Melengkapi administrasi dan berkas untuk menjadi santriwati resmi.", "judul": "Daftar Ulang"}], "biaya": [{"sma": "Rp [000.000]", "smp": "Rp [000.000]", "komponen": "Pendaftaran"}, {"sma": "Rp [0.000.000]", "smp": "Rp [0.000.000]", "komponen": "Uang pangkal (bisa dicicil)"}, {"sma": "Rp [000.000]", "smp": "Rp [000.000]", "komponen": "Asrama & makan per bulan"}, {"sma": "Rp [0.000.000]", "smp": "Rp [0.000.000]", "komponen": "Seragam & perlengkapan"}, {"sma": "Rp [000.000]", "smp": "Rp [000.000]", "komponen": "SPP per bulan"}], "brosur": "", "status": "Pendaftaran dibuka", "syarat": ["Calon santriwati (perempuan)", "SMP: lulusan SD/MI sederajat", "SMA: lulusan SMP/MTs sederajat", "Bersedia tinggal di asrama", "Fotokopi ijazah/SKL dan rapor terakhir", "Fotokopi Akta Kelahiran & Kartu Keluarga", "Pas foto 3×4 (4 lembar)", "Mampu membaca Al-Qur'an"], "rekening": "[Nama Bank – No. Rekening a.n. ...]", "gelombang": [{"nama": "Gelombang 1", "waktu": "[1 November – 31 Desember 2026]"}, {"nama": "Gelombang 2", "waktu": "[1 Januari – 28 Februari 2027]"}, {"nama": "Gelombang 3", "waktu": "[1 Maret – 30 April 2027]"}], "tahun_ajaran": "2027/2028", "catatan_biaya": "*Tersedia beasiswa untuk santriwati berprestasi dan penghafal Al-Qur'an. [Sesuaikan]", "langkah": [{"judul": "Buat Akun", "isi": "Calon santri diharapkan untuk membuat akun terlebih dahulu agar dapat login ke dalam sistem PPDB. Pada tahapan ini pastikan untuk menggunakan email aktif, karena kode verifikasi untuk pengaktifan akun akan dikirimkan melalui email.", "catatan": "", "tombol": "Buat akun sekarang", "tautan": "/pendaftaran/#daftar"}, {"judul": "Login", "isi": "Setelah calon santri membuat dan melakukan verifikasi akun, maka calon santri diharapkan untuk login ke dalam sistem PPDB.", "catatan": "", "tombol": "Login ke dashboard PPDB", "tautan": "/pendaftaran/"}, {"judul": "Pembayaran Registrasi", "isi": "Setelah login, calon santri terlebih dahulu harus melakukan pembayaran untuk biaya registrasi PPDB dan kemudian mengunggah (upload) bukti pembayaran tersebut.", "catatan": "Informasi terkait biaya pendaftaran serta rekening pembayaran dapat dilihat pada halaman ini secara detail.", "tombol": "Lihat biaya & rekening", "tautan": "#biaya"}, {"judul": "Pemilihan Sekolah", "isi": "Pada tahapan ini calon santri akan diberikan pilihan serta informasi terkait sekolah yang ingin didaftar (SMP-SMA IT atau TAKHASSUS TAHFIZH), yang kemudian calon santri harus menentukan pilihan sekolah.", "catatan": "Sebelum memilih sekolah, mohon untuk membaca informasi terkait sekolah terlebih dahulu.", "tombol": "Baca info program sekolah", "tautan": "/profil.html#visi-misi-program"}, {"judul": "Pengisian Biodata", "isi": "Pada tahapan ini calon santri diwajibkan untuk mengisi biodata sesuai dengan form yang telah disediakan. Harap untuk mengisi data tersebut dengan baik dan benar.", "catatan": "", "tombol": "", "tautan": ""}, {"judul": "Pengisian Berkas Wawancara", "isi": "Pada tahapan ini calon santri akan diberikan form wawancara terkait informasi calon santri, orang tua ataupun wali santri.", "catatan": "", "tombol": "", "tautan": ""}, {"judul": "Join Group WA", "isi": "Setelah mengisi data wawancara, silakan lanjut join group untuk mengetahui informasi-informasi seputar pondok dan tes.", "catatan": "", "tombol": "", "tautan": ""}, {"judul": "Tes/Seleksi Offline Tahap Awal", "isi": "Pada tahapan ini calon santri akan mengikuti tes tertulis & kesehatan. Tes tertulis yang dimaksudkan di sini terkait tentang kemampuan dalam membaca dan menghafal Al-Qur'an, akademik, atau pemahaman calon santri tentang Islam.", "catatan": "", "tombol": "", "tautan": ""}, {"judul": "Tes Tahap Akhir", "isi": "Pada tahap ini dilakukan pemeriksaan hasil kesehatan dan wawancara, tetapi hanya untuk calon santri yang lulus Tes Tahap Awal. Akan ada lampiran surat hasil kesehatan yang diminta sesuai dengan yang telah disepakati oleh pondok; hal ini ditujukan untuk menghindari adanya penyakit yang dapat mengganggu di dalam pondok/sekolah. Selain itu, akan ada wawancara calon santri dan ibu calon santri.", "catatan": "", "tombol": "", "tautan": ""}, {"judul": "Pengumuman Kelulusan", "isi": "Pada tahap ini calon santri akan menerima informasi kelulusan pada dashboard masing-masing di dalam sistem aplikasi PPDB. Sehingga untuk mengetahui kelulusan, calon santri wajib untuk login ke dalam sistem PPDB agar dapat mengetahui pengumuman kelulusan tersebut.", "catatan": "", "tombol": "Cek pengumuman di dashboard", "tautan": "/pendaftaran/"}], "online": {"dibuka": true, "biaya_registrasi": "", "info_bayar": "Transfer biaya registrasi ke rekening di bawah ini, lalu unggah foto atau scan bukti transfer. Panitia akan memeriksa bukti pembayaran Anda.", "info_tes_awal": "Jadwal dan tempat Tes Tahap Awal (tes tertulis & kesehatan) diumumkan oleh panitia melalui grup WhatsApp calon santri.", "info_tes_akhir": "Tes Tahap Akhir hanya untuk calon santri yang lulus Tes Tahap Awal: pemeriksaan hasil kesehatan serta wawancara calon santri dan ibu calon santri. Unggah surat hasil pemeriksaan kesehatan di bawah ini.", "info_lulus": "Selamat! Ananda dinyatakan LULUS seleksi PPDB. Silakan melakukan daftar ulang sesuai jadwal dan ketentuan yang diumumkan panitia.", "pertanyaan_wawancara": [{"bagian": "Calon santri", "pertanyaan": "Apa alasan ananda ingin bersekolah di Darul Marhamah?"}, {"bagian": "Calon santri", "pertanyaan": "Siapa yang paling mendorong ananda untuk mondok?"}, {"bagian": "Calon santri", "pertanyaan": "Bagaimana kebiasaan shalat lima waktu ananda di rumah?"}, {"bagian": "Calon santri", "pertanyaan": "Bagaimana kemampuan membaca Al-Qur'an ananda, dan berapa juz hafalan ananda saat ini?"}, {"bagian": "Calon santri", "pertanyaan": "Apa cita-cita ananda?"}, {"bagian": "Calon santri", "pertanyaan": "Apakah ananda siap tinggal di asrama dan mengikuti seluruh peraturan pondok?"}, {"bagian": "Orang tua / wali", "pertanyaan": "Apa harapan Bapak/Ibu setelah putri bersekolah di Darul Marhamah?"}, {"bagian": "Orang tua / wali", "pertanyaan": "Dari mana Bapak/Ibu mengetahui informasi tentang Darul Marhamah?"}, {"bagian": "Orang tua / wali", "pertanyaan": "Apakah putri memiliki riwayat penyakit atau kebutuhan khusus yang perlu diketahui pondok?"}, {"bagian": "Orang tua / wali", "pertanyaan": "Apakah Bapak/Ibu bersedia mendukung program dan peraturan pondok (termasuk aturan penggunaan HP dan jadwal kunjungan)?"}, {"bagian": "Orang tua / wali", "pertanyaan": "Apakah Bapak/Ibu sanggup memenuhi kewajiban biaya pendidikan sesuai ketentuan pondok?"}]}}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('program', $isi${"unggulan": [{"isi": "Halaqah hafalan harian dengan target [minimal 5 juz SMP / 10 juz SMA] dan setoran rutin kepada musyrifah.", "ikon": "📖", "judul": "Tahfidzul Qur'an"}, {"isi": "Penguasaan bahasa Arab aktif untuk memahami Al-Qur'an, hadits, dan kitab para ulama.", "ikon": "🗣️", "judul": "Bahasa Arab"}, {"isi": "Bimbingan langsung wudhu, shalat, dzikir, dan ibadah harian sesuai tuntunan sunnah.", "ikon": "🕌", "judul": "Praktik Ibadah"}, {"isi": "Menghafal hadits-hadits pilihan beserta penjelasan singkat dan pengamalannya.", "ikon": "📜", "judul": "Hafalan Hadits"}], "kurikulum": [{"isi": "Santriwati dibimbing memperbaiki bacaan (tahsin) lalu menambah hafalan secara bertahap dengan metode talaqqi dan murajaah terjadwal. Ujian tasmi' diadakan setiap semester.", "ikon": "📖", "judul": "Tahfidzul Qur'an & Tahsin"}, {"isi": "Pembelajaran nahwu, sharaf, dan percakapan sehari-hari, dilengkapi hari berbahasa Arab dan muhadharah.", "ikon": "🗣️", "judul": "Bahasa Arab Aktif"}, {"isi": "Mengkaji makna ayat-ayat yang dihafal agar hafalan disertai pemahaman dan pengamalan.", "ikon": "📘", "judul": "Tafsir Ringkas"}, {"isi": "Hafalan hadits arbain dan hadits adab, dipraktikkan dalam keseharian di sekolah dan asrama.", "ikon": "📜", "judul": "Hafalan Hadits & Adab"}, {"isi": "Mata pelajaran umum (Kurikulum Merdeka) tetap diajarkan lengkap sehingga lulusan siap melanjutkan ke jenjang berikutnya, negeri maupun swasta.", "ikon": "🧪", "judul": "Kurikulum Nasional"}], "keunggulan": [{"isi": "Kurikulum nasional dan kurikulum diniyah berjalan bersama dalam satu jadwal.", "judul": "Kurikulum Terintegrasi."}, {"isi": "Pembiasaan adab harian: salam, berbakti kepada orang tua, dan menghormati guru.", "judul": "Adab Sebelum Ilmu."}, {"isi": "Shalat berjamaah, dzikir pagi-petang, dan tilawah menjadi rutinitas setiap hari di asrama.", "judul": "Lingkungan Islami."}], "biaya_ringan": "Uang pangkal dapat dicicil [3 kali] dalam setahun. Tersedia beasiswa untuk santriwati berprestasi dan penghafal Al-Qur'an. [Sesuaikan]"}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('fasilitas', $isi${"fasilitas": [{"foto": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/fasilitas/1795428193526-whatsapp-image-2026-11-23-at-17.31.13.jpeg", "ikon": "🕌", "nama": "Masjid"}, {"foto": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/fasilitas/1795427111858-whatsapp-image-2026-11-23-at-17.32.05.jpg", "ikon": "🏫", "nama": "Ruang Kelas Nyaman"}, {"foto": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/fasilitas/1795434614261-r1qw-whatsapp-image-2026-01-01-at-12.05.44.jpeg", "ikon": "💻", "nama": "Laboratorium Komputer"}, {"foto": "", "ikon": "🔬", "nama": "Laboratorium IPA"}, {"foto": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/fasilitas/1795427130283-whatsapp-image-2026-11-23-at-17.31.13.jpeg", "ikon": "📚", "nama": "Perpustakaan"}, {"foto": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/fasilitas/1795427143541-whatsapp-image-2026-11-23-at-17.33.48.jpg", "ikon": "🛏️", "nama": "Asrama Putri"}, {"foto": "", "ikon": "🍽️", "nama": "Ruang Makan & Kantin"}, {"foto": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/fasilitas/1795427155856-whatsapp-image-2026-11-23-at-17.32.30.jpg", "ikon": "🩺", "nama": "UKS / Klinik"}], "ekstrakurikuler": [{"foto": "", "ikon": "🏹", "nama": "Panahan"}, {"foto": "", "ikon": "🍳", "nama": "Tata Boga"}, {"foto": "", "ikon": "🧵", "nama": "Menjahit & Kriya"}, {"foto": "", "ikon": "🎤", "nama": "Muhadharah"}, {"foto": "", "ikon": "✍️", "nama": "Jurnalistik"}, {"foto": "", "ikon": "🔬", "nama": "KIR / Sains"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('guru', $isi${"daftar": [{"foto": "", "nama": "[Nama Kepala SMP]", "jabatan": "Kepala SMP", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Kepala SMA]", "jabatan": "Kepala SMA", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Wakasek Kurikulum", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Wakasek Kesiswaan", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Ustadzah]", "jabatan": "Koordinator Tahfidz", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Bahasa Arab", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Matematika", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Bahasa Inggris", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru IPA", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Fiqih & Aqidah", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Guru]", "jabatan": "Guru Bahasa Indonesia", "kategori": "Guru"}, {"foto": "", "nama": "[Nama Ustadzah]", "jabatan": "Musyrifah Asrama", "kategori": "Tenaga Kependidikan"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('struktur', $isi${"daftar": [{"foto": "", "nama": "Muhammad Taufan Djafri, Lc., M.H.I.", "jabatan": "Ketua Yayasan"}, {"foto": "", "nama": "Abdullah, S.H., M.H.", "jabatan": "Kepala SMA"}, {"foto": "", "nama": "Nur Wahdania", "jabatan": "Kepala SMP"}, {"foto": "", "nama": "Damaianti", "jabatan": "Wakil Kepala SMP Bidang Kurikulum"}, {"foto": "", "nama": "Ummul Khair", "jabatan": "Wakil Kepala SMP Bidang Kesantrian"}, {"foto": "", "nama": "Arni, S.Si", "jabatan": "Wakil Kepala SMA Bidang Kurikulum"}, {"foto": "", "nama": "Sarah Suleman, S.H.", "jabatan": "Wakil Kepala SMA Bidang Kesantrian"}, {"foto": "", "nama": "Ummul Khair", "jabatan": "Wakil Kepala SMP Bidang Umum"}, {"foto": "", "nama": "Rahmawati Abdul Aziz", "jabatan": "Wakil Kepala SMA Bidang Umum"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('galeri', $isi${"daftar": [{"foto": "", "ikon": "🕌", "judul": "Shalat berjamaah", "kategori": "kegiatan"}, {"foto": "", "ikon": "📖", "judul": "Halaqah tahfidz", "kategori": "kegiatan"}, {"foto": "", "ikon": "🏆", "judul": "Juara MHQ", "kategori": "prestasi"}, {"foto": "", "ikon": "🏫", "judul": "Gedung sekolah", "kategori": "fasilitas"}, {"foto": "", "ikon": "⛺", "judul": "Persami Pramuka", "kategori": "kegiatan"}, {"foto": "", "ikon": "🔬", "judul": "Laboratorium IPA", "kategori": "fasilitas"}, {"foto": "", "ikon": "🥇", "judul": "Olimpiade sains", "kategori": "prestasi"}, {"foto": "", "ikon": "📚", "judul": "Perpustakaan", "kategori": "fasilitas"}, {"foto": "", "ikon": "🍳", "judul": "Ekskul tata boga", "kategori": "kegiatan"}, {"foto": "", "ikon": "🎤", "judul": "Muhadharah", "kategori": "kegiatan"}, {"foto": "", "ikon": "🎖️", "judul": "Lomba pidato", "kategori": "prestasi"}, {"foto": "", "ikon": "🛏️", "judul": "Asrama putri", "kategori": "fasilitas"}, {"foto": "https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/galeri/1795446526139-zwdu-whatsapp-image-2026-11-23-at-13.39.40.jpeg", "ikon": "", "judul": "Ujian Akhir Semester", "kategori": "kegiatan"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('testimoni', $isi${"daftar": [{"isi": "Alhamdulillah, sejak sekolah di sini putri kami semakin rajin shalat dan hafalannya terus bertambah. Ustadzahnya sabar dan perhatian. ", "foto": "", "nama": "Ummu Fulanah", "video": "https://www.youtube.com/watch?v=FVZYI6cJBuU", "kategori": "Orang Tua", "keterangan": "Wali santriwati kelas VII", "video_embed": "https://www.youtube-nocookie.com/embed/FVZYI6cJBuU?rel=0&playsinline=1", "video_link": "https://www.youtube.com/watch?v=FVZYI6cJBuU", "video_jenis": "youtube", "video_tegak": false, "video_gambar": "https://i.ytimg.com/vi/FVZYI6cJBuU/hqdefault.jpg"}, {"isi": "Kami senang karena pelajaran umum dan agama sama-sama diperhatikan. Putri kami jadi lebih mandiri dan sopan. [Contoh testimoni]", "foto": "", "nama": "[Nama Orang Tua]", "video": "", "kategori": "Orang Tua", "keterangan": "Wali santriwati kelas XI"}, {"isi": "Bekal hafalan dan bahasa Arab dari sekolah sangat membantu saya ketika melanjutkan kuliah.", "foto": "", "nama": "Khaulah Ansyar", "video": "https://www.instagram.com/reel/DQvjyquj1T3/", "kategori": "Alumni", "keterangan": "Alumni angkatan 11", "video_embed": "https://www.instagram.com/reel/DQvjyquj1T3/embed/", "video_link": "https://www.instagram.com/reel/DQvjyquj1T3/", "video_jenis": "instagram", "video_tegak": true}, {"isi": "", "foto": "", "nama": "", "video": "", "kategori": "", "keterangan": ""}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('video', $isi${"daftar": [{"url": "https://www.youtube.com/watch?v=blhCKCdn8Ew", "judul": "Profil Darul Marhamah Al-Qur'an Boarding School"}]}$isi$::jsonb) on conflict (kunci) do nothing;
insert into public.konten (kunci, data) values ('download', $isi${"daftar": [{"file": "", "judul": "Kalender Akademik 2026/2027", "kategori": "Akademik"}, {"file": "", "judul": "Brosur PPDB 2027/2028", "kategori": "PPDB"}, {"file": "/assets/logo-512.png", "judul": "Logo Darul Marhamah ABS", "kategori": "Identitas"}]}$isi$::jsonb) on conflict (kunci) do nothing;

insert into public.berita (judul, slug, tanggal, kategori, gambar, ringkasan, isi)
select * from (values
  ($isi$Tim Sains Lolos ke Olimpiade Sains Tingkat Provinsi$isi$, $isi$tim-sains-olimpiade-provinsi$isi$, '2026-10-10'::date, $isi$Prestasi$isi$, $isi$$isi$, $isi$[Contoh berita] Tiga santriwati mewakili sekolah pada OSN bidang Biologi, Kimia, dan Matematika.$isi$, $isi$<p>[Contoh berita] Tiga santriwati lolos mewakili sekolah pada Olimpiade Sains Nasional tingkat provinsi bidang Biologi, Kimia, dan Matematika.</p>$isi$),
  ($isi$Outing Class ke Museum dan Benteng Rotterdam$isi$, $isi$outing-class-benteng-rotterdam$isi$, '2026-10-18'::date, $isi$Kegiatan$isi$, $isi$$isi$, $isi$[Contoh berita] Belajar sejarah langsung di lapangan bersama wali kelas.$isi$, $isi$<p>[Contoh berita] Santriwati belajar sejarah Kota Makassar secara langsung di Benteng Rotterdam bersama wali kelas.</p>$isi$),
  ($isi$Penerimaan Santriwati Baru SMP & SMA 2027/2028 Dibuka$isi$, $isi$ppdb-2027-2028-dibuka$isi$, '2026-10-25'::date, $isi$PPDB$isi$, $isi$$isi$, $isi$[Contoh berita] Kuota terbatas. Segera daftarkan putri Anda melalui halaman Info PPDB.$isi$, $isi$<p>[Contoh berita] Pendaftaran santriwati baru jenjang SMP dan SMA tahun ajaran 2027/2028 telah dibuka. Informasi lengkap ada di halaman Info PPDB.</p>$isi$),
  ($isi$Penilaian Tengah Semester Ganjil Berjalan Lancar$isi$, $isi$penilaian-tengah-semester$isi$, '2026-11-01'::date, $isi$Akademik$isi$, $isi$$isi$, $isi$[Contoh berita] PTS semester ganjil tahun ajaran 2026/2027 dilaksanakan berbasis komputer.$isi$, $isi$<p>[Contoh berita] Penilaian Tengah Semester (PTS) ganjil tahun ajaran 2026/2027 telah dilaksanakan dengan tertib dan lancar.</p>$isi$),
  ($isi$Mabit dan Qiyamul Lail Bersama Seluruh Santriwati$isi$, $isi$mabit-dan-qiyamul-lail$isi$, '2026-11-08'::date, $isi$Kegiatan$isi$, $isi$$isi$, $isi$[Contoh berita] Malam bina iman dan takwa untuk memperkuat ruhiyah santriwati SMP dan SMA.$isi$, $isi$<p>[Contoh berita] Kegiatan malam bina iman dan takwa (mabit) diikuti seluruh santriwati SMP dan SMA, diisi dengan kajian, tilawah, dan qiyamul lail berjamaah.</p>$isi$),
  ($isi$Santriwati Raih Juara 1 Musabaqah Hifzhil Qur'an Tingkat Kota Makassar$isi$, $isi$juara-mhq-tingkat-kota-makassar$isi$, '2026-11-15'::date, $isi$Prestasi$isi$, $isi$https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/berita/1795413693747-chatgpt-image-22-sep-2026-14.15.20.jpg$isi$, $isi$[Contoh berita] Ananda [Nama Santriwati] kelas XI meraih juara pertama MHQ kategori 10 juz.$isi$, $isi$<p>[Contoh berita] Alhamdulillah, Ananda [Nama Santriwati] dari kelas XI SMA IT Darul Marhamah ABS berhasil meraih juara pertama Musabaqah Hifzhil Qur'an kategori 10 juz tingkat Kota Makassar. Semoga menjadi motivasi bagi seluruh santriwati.</p><p>Silakan ganti isi berita ini melalui panel admin.</p>$isi$),
  ($isi$Menang Lomba CCQL ME$isi$, $isi$menang-lomba-ccql-me$isi$, '2026-11-23'::date, $isi$Kegiatan$isi$, $isi$https://utnbooeoaaolcuymgelb.supabase.co/storage/v1/object/public/media/berita/1795413833780-whatsapp-image-2026-02-04-at-20.27.24.jpeg$isi$, $isi$Selamat$isi$, $isi$$isi$)
) as v(judul, slug, tanggal, kategori, gambar, ringkasan, isi)
where not exists (select 1 from public.berita);

-- =====================================================================
--  PPDB ONLINE — akun calon santri, berkas, status seleksi, nilai tes,
--  tautan menu ke halaman Program Tahfizh & Program Takhassus, berkas syarat
--  lulus tes tahap akhir, dan tagihan pembayaran
--  Cara pakai: Supabase → SQL Editor → New query → tempel SELURUH isi file
--  ini → klik RUN. Aman dijalankan ulang. Tidak perlu mengubah apa pun.
-- =====================================================================

-- ---------- 1. Data pendaftar (satu baris per akun calon santri) ----------
create sequence if not exists public.pendaftar_urut;

create table if not exists public.pendaftar (
  id                uuid primary key references auth.users on delete cascade,
  nomor             text unique,
  email             text,
  nama              text not null default '',
  no_wa             text not null default '',
  bukti_bayar       text not null default '',
  status_bayar      text not null default 'belum'
                    check (status_bayar in ('belum', 'menunggu', 'diterima', 'ditolak')),
  jenjang           text not null default '',
  program           text not null default '',
  biodata           jsonb not null default '{}'::jsonb,
  biodata_lengkap   boolean not null default false,
  wawancara         jsonb not null default '{}'::jsonb,
  wawancara_lengkap boolean not null default false,
  gabung_grup       boolean not null default false,
  surat_sehat       text not null default '',
  tes_awal          text not null default 'belum' check (tes_awal in ('belum', 'lulus', 'tidak_lulus')),
  tes_akhir         text not null default 'belum' check (tes_akhir in ('belum', 'lulus', 'tidak_lulus')),
  kelulusan         text not null default 'belum' check (kelulusan in ('belum', 'lulus', 'tidak_lulus', 'cadangan')),
  pesan_panitia     text not null default '',
  dibuat            timestamptz not null default now(),
  diubah            timestamptz not null default now()
);

-- Calon santri hanya boleh mengubah isiannya sendiri; status seleksi hanya diubah panitia.
create or replace function public.jaga_pendaftar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  panitia boolean := public.boleh('pendaftar');
begin
  if tg_op = 'INSERT' then
    if new.nomor is null or new.nomor = '' then
      new.nomor := 'PPDB-' || to_char(now() at time zone 'Asia/Makassar', 'YY') || '-' || lpad(nextval('public.pendaftar_urut')::text, 4, '0');
    end if;
    if not panitia then
      new.status_bayar := case when coalesce(new.bukti_bayar, '') <> '' then 'menunggu' else 'belum' end;
      new.tes_awal := 'belum'; new.tes_akhir := 'belum'; new.kelulusan := 'belum'; new.pesan_panitia := '';
    end if;
    new.dibuat := now(); new.diubah := now();
    return new;
  end if;
  -- UPDATE
  new.id := old.id; new.nomor := old.nomor; new.dibuat := old.dibuat;
  if not panitia then
    new.email := old.email;
    new.tes_awal := old.tes_awal; new.tes_akhir := old.tes_akhir;
    new.kelulusan := old.kelulusan; new.pesan_panitia := old.pesan_panitia;
    -- Bukti bayar yang sudah diterima tidak bisa diganti; bukti baru menunggu pemeriksaan
    if old.status_bayar = 'diterima' then
      new.bukti_bayar := old.bukti_bayar; new.status_bayar := 'diterima';
    elsif new.bukti_bayar is distinct from old.bukti_bayar and coalesce(new.bukti_bayar, '') <> '' then
      new.status_bayar := 'menunggu';
    else
      new.status_bayar := old.status_bayar;
    end if;
    -- Setelah kelulusan diumumkan, data tidak bisa diubah lagi oleh calon santri
    if old.kelulusan <> 'belum' then
      new.jenjang := old.jenjang; new.program := old.program;
      new.biodata := old.biodata; new.biodata_lengkap := old.biodata_lengkap;
      new.wawancara := old.wawancara; new.wawancara_lengkap := old.wawancara_lengkap;
      new.surat_sehat := old.surat_sehat;
    end if;
  end if;
  new.diubah := now();
  return new;
end $$;

drop trigger if exists jaga_pendaftar on public.pendaftar;
create trigger jaga_pendaftar before insert or update on public.pendaftar
  for each row execute function public.jaga_pendaftar();

-- ---------- 2. Akun baru: calon santri → pendaftar, staf → profil ----------
-- (Menggantikan versi sebelumnya. Akun pertama staf tetap otomatis menjadi Admin.)
create or replace function public.buat_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'jenis', '') = 'pendaftar' then
    insert into public.pendaftar (id, email, nama, no_wa)
    values (new.id, new.email, left(coalesce(new.raw_user_meta_data->>'nama', ''), 120),
            left(coalesce(new.raw_user_meta_data->>'no_wa', ''), 30))
    on conflict (id) do nothing;
    return new;
  end if;
  insert into public.profil (id, email, nama, peran)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nama', ''),
          case when (select count(*) from public.profil) = 0 then 'admin' else 'menunggu' end)
  on conflict (id) do nothing;
  return new;
end $$;

-- Hak akses "pendaftar" (melihat & mengelola data pendaftar) dibuka admin lewat
-- Panel Admin → Peran & Hak Akses → kolom "Pendaftar PPDB". Admin selalu boleh.

-- ---------- 3. Pengaturan rahasia PPDB (link grup WhatsApp) ----------
create table if not exists public.ppdb_rahasia (
  id      int primary key default 1 check (id = 1),
  grup_wa jsonb not null default '[]'::jsonb,
  diubah  timestamptz not null default now()
);
insert into public.ppdb_rahasia (id) values (1) on conflict (id) do nothing;

-- ---------- 4. Keamanan (Row Level Security) ----------
alter table public.pendaftar enable row level security;
alter table public.ppdb_rahasia enable row level security;
revoke all on public.pendaftar, public.ppdb_rahasia from anon;
grant select, insert, update, delete on public.pendaftar to authenticated;
grant select, insert, update on public.ppdb_rahasia to authenticated;
grant usage on sequence public.pendaftar_urut to authenticated;

drop policy if exists "pendaftar dibaca" on public.pendaftar;
create policy "pendaftar dibaca" on public.pendaftar for select to authenticated
  using (id = auth.uid() or public.boleh('pendaftar'));
drop policy if exists "pendaftar ditambah" on public.pendaftar;
create policy "pendaftar ditambah" on public.pendaftar for insert to authenticated
  with check ((id = auth.uid() and coalesce(auth.jwt()->'user_metadata'->>'jenis', '') = 'pendaftar') or public.boleh('pendaftar'));
drop policy if exists "pendaftar diubah" on public.pendaftar;
create policy "pendaftar diubah" on public.pendaftar for update to authenticated
  using (id = auth.uid() or public.boleh('pendaftar')) with check (id = auth.uid() or public.boleh('pendaftar'));
drop policy if exists "pendaftar dihapus panitia" on public.pendaftar;
create policy "pendaftar dihapus panitia" on public.pendaftar for delete to authenticated
  using (public.boleh('pendaftar'));

-- Link grup WA hanya terlihat oleh panitia dan calon santri yang sudah mengisi wawancara
drop policy if exists "rahasia dibaca" on public.ppdb_rahasia;
create policy "rahasia dibaca" on public.ppdb_rahasia for select to authenticated
  using (public.boleh('pendaftar') or exists (
    select 1 from public.pendaftar p where p.id = auth.uid() and p.wawancara_lengkap));
drop policy if exists "rahasia diubah panitia" on public.ppdb_rahasia;
create policy "rahasia diubah panitia" on public.ppdb_rahasia for update to authenticated
  using (public.boleh('pendaftar')) with check (public.boleh('pendaftar'));
drop policy if exists "rahasia ditambah panitia" on public.ppdb_rahasia;
create policy "rahasia ditambah panitia" on public.ppdb_rahasia for insert to authenticated
  with check (public.boleh('pendaftar'));

-- ---------- 5. Berkas pendaftar (privat: bukti bayar, surat kesehatan) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ppdb', 'ppdb', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ppdb diunggah pemilik" on storage.objects;
create policy "ppdb diunggah pemilik" on storage.objects for insert to authenticated
  with check (bucket_id = 'ppdb' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.pendaftar p where p.id = auth.uid()));
drop policy if exists "ppdb dibaca pemilik atau panitia" on storage.objects;
create policy "ppdb dibaca pemilik atau panitia" on storage.objects for select to authenticated
  using (bucket_id = 'ppdb' and ((storage.foldername(name))[1] = auth.uid()::text or public.boleh('pendaftar')));
drop policy if exists "ppdb dihapus panitia" on storage.objects;
create policy "ppdb dihapus panitia" on storage.objects for delete to authenticated
  using (bucket_id = 'ppdb' and public.boleh('pendaftar'));

-- ---------- 6. Nilai tes calon santri (panitia & penguji; tidak terlihat oleh calon santri) ----------
-- Komponen nilai (Sholat, Tajwid, dst.) bisa ditambah/dihapus dari panel admin → Pendaftar PPDB → Rekap Nilai.
create table if not exists public.ppdb_penilaian (
  id          int primary key default 1 check (id = 1),
  komponen    jsonb not null default '[]'::jsonb,
  batas_lulus numeric,
  diubah      timestamptz not null default now()
);
insert into public.ppdb_penilaian (id, komponen) values (1, $komponen$[
  {"kode": "sholat",   "nama": "Sholat",             "jenis": "Nilai",  "maks": 100, "satuan": "",     "keterangan": "", "catatan": false, "bobot": 1},
  {"kode": "tajwid",   "nama": "Tajwid",             "jenis": "Nilai",  "maks": 100, "satuan": "",     "keterangan": "", "catatan": true,  "bobot": 1},
  {"kode": "hafalan",  "nama": "Pencapaian Hafalan", "jenis": "Jumlah", "maks": 13,  "satuan": "ayat", "materi": "QS. Al-Jumu'ah ayat 1-8", "keterangan": "", "catatan": false, "bobot": 1},
  {"kode": "tahfizh",  "nama": "Tahfizh",            "jenis": "Nilai",  "maks": 100, "satuan": "",     "keterangan": "", "catatan": false, "bobot": 1},
  {"kode": "akademik", "nama": "Akademik",           "jenis": "Nilai",  "maks": 100, "satuan": "",     "keterangan": "", "catatan": false, "bobot": 1}
]$komponen$::jsonb) on conflict (id) do nothing;

create table if not exists public.pendaftar_nilai (
  id      uuid primary key references public.pendaftar(id) on delete cascade,
  nilai   jsonb not null default '{}'::jsonb,   -- { kode_komponen: angka }
  catatan jsonb not null default '{}'::jsonb,   -- { kode_komponen: teks }
  penilai text not null default '',
  diubah  timestamptz not null default now()
);

alter table public.ppdb_penilaian enable row level security;
alter table public.pendaftar_nilai enable row level security;
revoke all on public.ppdb_penilaian, public.pendaftar_nilai from anon;
grant select, insert, update on public.ppdb_penilaian to authenticated;
grant select, insert, update, delete on public.pendaftar_nilai to authenticated;
-- Hak akses "Input Nilai SPMB" (kode nilai_ppdb): penguji boleh mengisi nilai tanpa melihat biodata,
-- berkas, atau status pendaftar. Pengaturan komponen nilai tetap hanya untuk panitia (akses Pendaftar PPDB).
drop policy if exists "penilaian panitia" on public.ppdb_penilaian;
drop policy if exists "penilaian dibaca" on public.ppdb_penilaian;
create policy "penilaian dibaca" on public.ppdb_penilaian for select to authenticated
  using (public.boleh('pendaftar') or public.boleh('nilai_ppdb'));
drop policy if exists "penilaian ditambah panitia" on public.ppdb_penilaian;
create policy "penilaian ditambah panitia" on public.ppdb_penilaian for insert to authenticated
  with check (public.boleh('pendaftar'));
drop policy if exists "penilaian diubah panitia" on public.ppdb_penilaian;
create policy "penilaian diubah panitia" on public.ppdb_penilaian for update to authenticated
  using (public.boleh('pendaftar')) with check (public.boleh('pendaftar'));
drop policy if exists "nilai panitia" on public.pendaftar_nilai;
drop policy if exists "nilai dibaca" on public.pendaftar_nilai;
create policy "nilai dibaca" on public.pendaftar_nilai for select to authenticated
  using (public.boleh('pendaftar') or public.boleh('nilai_ppdb'));
drop policy if exists "nilai diisi" on public.pendaftar_nilai;
create policy "nilai diisi" on public.pendaftar_nilai for insert to authenticated
  with check (public.boleh('pendaftar') or public.boleh('nilai_ppdb'));
drop policy if exists "nilai diubah" on public.pendaftar_nilai;
create policy "nilai diubah" on public.pendaftar_nilai for update to authenticated
  using (public.boleh('pendaftar') or public.boleh('nilai_ppdb')) with check (public.boleh('pendaftar') or public.boleh('nilai_ppdb'));
drop policy if exists "nilai dihapus panitia" on public.pendaftar_nilai;
create policy "nilai dihapus panitia" on public.pendaftar_nilai for delete to authenticated
  using (public.boleh('pendaftar'));

-- Daftar peserta tes untuk penguji: hanya nomor, nama, dan pilihan sekolah (tanpa biodata/kontak/berkas)
create or replace function public.peserta_tes()
returns table (id uuid, nomor text, nama text, jenjang text, program text, status_bayar text, wawancara_lengkap boolean, dibuat timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.nomor, p.nama, p.jenjang, p.program, p.status_bayar, p.wawancara_lengkap, p.dibuat
  from public.pendaftar p
  where public.boleh('pendaftar') or public.boleh('nilai_ppdb')
  order by p.dibuat;
$$;
revoke all on function public.peserta_tes() from public, anon;
grant execute on function public.peserta_tes() to authenticated;

-- Peran siap pakai untuk guru penguji (ubah atau hapus di panel admin → Peran & Hak Akses)
insert into public.peran (kode, nama, akses, urutan) values ('penguji', 'Penguji SPMB', array['nilai_ppdb'], 30)
on conflict (kode) do nothing;

-- ---------- 7. Menu website: tambahkan halaman Program Tahfizh & Program Takhassus ----------
-- Dua tautan ditambahkan di bagian atas submenu "Sekolah" (hanya sekali; isi menu lainnya tidak diubah).
update public.konten k
set data = jsonb_set(k.data, '{daftar}', (
      select jsonb_agg(case when e->>'link' = '/sekolah.html'
        then jsonb_set(e, '{sub}', $menu$[
          {"link": "/program-tahfizh.html", "judul": "Program Tahfizh (Sukamaju)"},
          {"link": "/program-takhassus.html", "judul": "Program Takhassus (Asal Mula)"}
        ]$menu$::jsonb || coalesce(e->'sub', '[]'::jsonb))
        else e end order by t.i)
      from jsonb_array_elements(k.data->'daftar') with ordinality as t(e, i))),
    diubah = now()
where k.kunci = 'menu'
  and jsonb_typeof(k.data->'daftar') = 'array'
  and position('/program-tahfizh.html' in k.data::text) = 0
  and exists (select 1 from jsonb_array_elements(k.data->'daftar') x where x->>'link' = '/sekolah.html');

-- ---------- 8. Berkas syarat lulus Tes Tahap Akhir (langkah 09) dan tagihan pembayaran ----------
-- Daftar berkas bisa ditambah/dihapus di panel admin → Pendaftar PPDB → Berkas & tagihan.
-- Jenis "Pembayaran": panitia mencatat nominal yang dibayar; jika belum lunas, sisanya tetap tercatat
-- di tabel tagihan (dipakai juga oleh modul keuangan/akunting nanti).
create table if not exists public.ppdb_syarat (
  id     int primary key default 1 check (id = 1),
  berkas jsonb not null default '[]'::jsonb,
  diubah timestamptz not null default now()
);
insert into public.ppdb_syarat (id, berkas) values (1, $berkas$[
  {"kode": "kesehatan", "nama": "Surat Hasil Pemeriksaan Kesehatan", "jenis": "Berkas", "wajib": true, "format": "",
   "keterangan": "Unduh format surat, minta dokter/puskesmas mengisinya, lalu unggah foto atau scan surat yang sudah ditandatangani."},
  {"kode": "bayar_administrasi", "nama": "Bukti Bayar Administrasi", "jenis": "Pembayaran", "wajib": true, "format": "", "biaya_smp": 0, "biaya_sma": 0,
   "keterangan": "Transfer biaya administrasi ke rekening pondok, lalu unggah bukti transfer. Jika belum bisa membayar penuh, sisanya dicatat sebagai tagihan."},
  {"kode": "pernyataan", "nama": "Surat Pernyataan Menaati Peraturan Pondok", "jenis": "Berkas", "wajib": true, "format": "",
   "keterangan": "Unduh format surat pernyataan, cetak, isi, dan tanda tangani, lalu unggah foto atau scan-nya."}
]$berkas$::jsonb) on conflict (id) do nothing;

create table if not exists public.pendaftar_berkas (
  pendaftar uuid not null references public.pendaftar(id) on delete cascade,
  kode      text not null,                         -- kode berkas di ppdb_syarat
  berkas    text not null default '',              -- jalur file di bucket "ppdb"
  status    text not null default 'menunggu' check (status in ('menunggu', 'diterima', 'ditolak')),
  catatan   text not null default '',              -- alasan penolakan dari panitia
  pemeriksa text not null default '',
  diunggah  timestamptz not null default now(),
  diperiksa timestamptz,
  primary key (pendaftar, kode)
);

create table if not exists public.tagihan (
  id      bigint generated by default as identity primary key,
  akun    uuid not null references auth.users on delete cascade,   -- akun calon santri (nanti: santri)
  kode    text not null,                                           -- mis. bayar_administrasi
  nama    text not null default '',
  jumlah  numeric(14, 0) not null default 0 check (jumlah >= 0),   -- total yang harus dibayar
  dibayar numeric(14, 0) not null default 0 check (dibayar >= 0),  -- dihitung otomatis dari tabel pembayaran
  sisa    numeric(14, 0) generated always as (greatest(jumlah - dibayar, 0)) stored,
  status  text generated always as (case when dibayar >= jumlah then 'lunas' when dibayar > 0 then 'sebagian' else 'belum' end) stored,
  sumber  text not null default 'ppdb',
  dibuat  timestamptz not null default now(),
  diubah  timestamptz not null default now(),
  unique (akun, kode)
);

create table if not exists public.pembayaran (
  id           bigint generated by default as identity primary key,
  tagihan      bigint not null references public.tagihan(id) on delete cascade,
  jumlah       numeric(14, 0) not null check (jumlah > 0),
  bukti        text not null default '',                           -- jalur bukti transfer di bucket "ppdb"
  tanggal      date not null default ((now() at time zone 'Asia/Makassar')::date),
  dicatat_oleh text not null default '',
  dibuat       timestamptz not null default now(),
  unique (tagihan, bukti)
);

-- Surat kesehatan yang diunggah sebelum fitur ini ada → jadi berkas "kesehatan"
insert into public.pendaftar_berkas (pendaftar, kode, berkas, status)
select p.id, 'kesehatan', p.surat_sehat, 'menunggu' from public.pendaftar p where p.surat_sehat <> ''
on conflict (pendaftar, kode) do nothing;

-- Calon santri hanya boleh mengunggah/mengganti berkasnya sendiri; status & catatan hanya diubah panitia.
create or replace function public.jaga_berkas() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.pendaftar;
  staf text;
begin
  if auth.uid() is null or public.boleh('pendaftar') then
    if tg_op = 'INSERT' or new.status is distinct from old.status then
      new.diperiksa := case when new.status = 'menunggu' then null else now() end;
      select coalesce(nullif(nama, ''), email, '') into staf from public.profil where id = auth.uid();
      if new.status <> 'menunggu' then new.pemeriksa := coalesce(staf, new.pemeriksa); end if;
    end if;
    -- Penerimaan bukti bayar dibatalkan → catatan pembayarannya ikut dihapus
    if tg_op = 'UPDATE' and old.status = 'diterima' and (new.status <> 'diterima' or new.berkas <> old.berkas) then
      delete from public.pembayaran b using public.tagihan t
      where b.tagihan = t.id and t.akun = old.pendaftar and t.kode = old.kode and b.bukti = old.berkas;
    end if;
    return new;
  end if;
  select * into p from public.pendaftar where id = new.pendaftar;
  if p.id is null or p.id <> auth.uid() then raise exception 'Akses ditolak.'; end if;
  if p.tes_awal <> 'lulus' then raise exception 'Berkas tahap akhir baru bisa diunggah setelah lulus Tes Tahap Awal.'; end if;
  if p.tes_akhir <> 'belum' or p.kelulusan <> 'belum' then raise exception 'Berkas sudah dikunci karena hasil Tes Tahap Akhir sudah keluar.'; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'diterima' then raise exception 'Berkas ini sudah diterima panitia dan tidak bisa diganti.'; end if;
    new.pendaftar := old.pendaftar; new.kode := old.kode;
  end if;
  if coalesce(new.berkas, '') = '' or split_part(new.berkas, '/', 1) <> auth.uid()::text then raise exception 'Berkas tidak valid.'; end if;
  if not exists (select 1 from public.ppdb_syarat s, jsonb_array_elements(s.berkas) e where s.id = 1 and e->>'kode' = new.kode) then
    raise exception 'Jenis berkas ini tidak lagi diminta panitia. Muat ulang halaman.';
  end if;
  new.status := 'menunggu'; new.catatan := ''; new.pemeriksa := ''; new.diunggah := now(); new.diperiksa := null;
  return new;
end $$;
drop trigger if exists jaga_berkas on public.pendaftar_berkas;
create trigger jaga_berkas before insert or update on public.pendaftar_berkas
  for each row execute function public.jaga_berkas();

-- Total "dibayar" di tagihan selalu = jumlah semua pembayaran
create or replace function public.hitung_tagihan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.tagihan t
  set dibayar = coalesce((select sum(b.jumlah) from public.pembayaran b where b.tagihan = t.id), 0), diubah = now()
  where t.id in (new.tagihan, old.tagihan);
  return null;
end $$;
drop trigger if exists hitung_tagihan on public.pembayaran;
create trigger hitung_tagihan after insert or update or delete on public.pembayaran
  for each row execute function public.hitung_tagihan();

-- Panitia menerima bukti bayar: catat total biaya & nominal yang dibayar, sisa otomatis jadi tagihan
create or replace function public.terima_pembayaran_ppdb(p_pendaftar uuid, p_kode text, p_total numeric, p_dibayar numeric)
returns public.tagihan
language plpgsql security definer set search_path = public as $$
declare
  b public.pendaftar_berkas;
  t public.tagihan;
  nama_item text;
  staf text;
begin
  if not public.boleh('pendaftar') then raise exception 'Akses ditolak.'; end if;
  if p_total is null or p_total < 0 then raise exception 'Total biaya harus diisi.'; end if;
  if p_dibayar is null or p_dibayar <= 0 then raise exception 'Nominal yang dibayar harus lebih dari 0.'; end if;
  select * into b from public.pendaftar_berkas where pendaftar = p_pendaftar and kode = p_kode;
  if b.pendaftar is null or b.berkas = '' then raise exception 'Bukti bayar belum diunggah.'; end if;
  select e->>'nama' into nama_item from public.ppdb_syarat s, jsonb_array_elements(s.berkas) e
  where s.id = 1 and e->>'kode' = p_kode and e->>'jenis' = 'Pembayaran' limit 1;
  if nama_item is null then raise exception 'Berkas ini bukan jenis Pembayaran.'; end if;
  select coalesce(nullif(nama, ''), email, '') into staf from public.profil where id = auth.uid();
  insert into public.tagihan (akun, kode, nama, jumlah) values (p_pendaftar, p_kode, coalesce(nama_item, p_kode), round(p_total))
  on conflict (akun, kode) do update set jumlah = excluded.jumlah, nama = excluded.nama, diubah = now()
  returning * into t;
  insert into public.pembayaran (tagihan, jumlah, bukti, dicatat_oleh) values (t.id, round(p_dibayar), b.berkas, coalesce(staf, ''))
  on conflict (tagihan, bukti) do update set jumlah = excluded.jumlah, dicatat_oleh = excluded.dicatat_oleh;
  update public.pendaftar_berkas set status = 'diterima', catatan = '' where pendaftar = p_pendaftar and kode = p_kode;
  select * into t from public.tagihan where id = t.id;
  return t;
end $$;
revoke all on function public.terima_pembayaran_ppdb(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.terima_pembayaran_ppdb(uuid, text, numeric, numeric) to authenticated;

alter table public.ppdb_syarat enable row level security;
alter table public.pendaftar_berkas enable row level security;
alter table public.tagihan enable row level security;
alter table public.pembayaran enable row level security;
revoke all on public.ppdb_syarat, public.pendaftar_berkas, public.tagihan, public.pembayaran from anon;
grant select, insert, update on public.ppdb_syarat to authenticated;
grant select, insert, update, delete on public.pendaftar_berkas, public.tagihan, public.pembayaran to authenticated;

drop policy if exists "syarat dibaca" on public.ppdb_syarat;
create policy "syarat dibaca" on public.ppdb_syarat for select to authenticated using (true);
drop policy if exists "syarat ditambah panitia" on public.ppdb_syarat;
create policy "syarat ditambah panitia" on public.ppdb_syarat for insert to authenticated
  with check (public.boleh('pendaftar'));
drop policy if exists "syarat diubah panitia" on public.ppdb_syarat;
create policy "syarat diubah panitia" on public.ppdb_syarat for update to authenticated
  using (public.boleh('pendaftar')) with check (public.boleh('pendaftar'));

drop policy if exists "berkas dibaca" on public.pendaftar_berkas;
create policy "berkas dibaca" on public.pendaftar_berkas for select to authenticated
  using (pendaftar = auth.uid() or public.boleh('pendaftar'));
drop policy if exists "berkas diunggah" on public.pendaftar_berkas;
create policy "berkas diunggah" on public.pendaftar_berkas for insert to authenticated
  with check (pendaftar = auth.uid() or public.boleh('pendaftar'));
drop policy if exists "berkas diubah" on public.pendaftar_berkas;
create policy "berkas diubah" on public.pendaftar_berkas for update to authenticated
  using (pendaftar = auth.uid() or public.boleh('pendaftar')) with check (pendaftar = auth.uid() or public.boleh('pendaftar'));
drop policy if exists "berkas dihapus panitia" on public.pendaftar_berkas;
create policy "berkas dihapus panitia" on public.pendaftar_berkas for delete to authenticated
  using (public.boleh('pendaftar'));

drop policy if exists "tagihan dibaca" on public.tagihan;
create policy "tagihan dibaca" on public.tagihan for select to authenticated
  using (akun = auth.uid() or public.boleh('pendaftar'));
drop policy if exists "tagihan dikelola panitia" on public.tagihan;
create policy "tagihan dikelola panitia" on public.tagihan for all to authenticated
  using (public.boleh('pendaftar')) with check (public.boleh('pendaftar'));

drop policy if exists "pembayaran dibaca" on public.pembayaran;
create policy "pembayaran dibaca" on public.pembayaran for select to authenticated
  using (public.boleh('pendaftar') or exists (select 1 from public.tagihan t where t.id = pembayaran.tagihan and t.akun = auth.uid()));
drop policy if exists "pembayaran dikelola panitia" on public.pembayaran;
create policy "pembayaran dikelola panitia" on public.pembayaran for all to authenticated
  using (public.boleh('pendaftar')) with check (public.boleh('pendaftar'));

-- Teks bawaan langkah 09 di dashboard calon santri (hanya diganti jika belum pernah diubah)
update public.konten k
set data = jsonb_set(k.data, '{online,info_tes_akhir}', to_jsonb('Tes Tahap Akhir hanya untuk calon santri yang lulus Tes Tahap Awal: pemeriksaan hasil kesehatan serta wawancara calon santri dan ibu calon santri. Lengkapi berkas syarat lulus di bawah ini: unduh formatnya (jika ada), isi, lalu unggah.'::text)),
    diubah = now()
where k.kunci = 'ppdb'
  and k.data->'online'->>'info_tes_akhir' = 'Tes Tahap Akhir hanya untuk calon santri yang lulus Tes Tahap Awal: pemeriksaan hasil kesehatan serta wawancara calon santri dan ibu calon santri. Unggah surat hasil pemeriksaan kesehatan di bawah ini.';

