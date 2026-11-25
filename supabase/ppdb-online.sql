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

-- ---------- 3b. Akun panitia per program (mis. Ketua Panitia PPDB khusus Program Tahfizh) ----------
-- Admin mengatur "Program" setiap akun di Panel Admin → Pengguna. Kosong = semua program.
-- Akun berprogram hanya melihat pendaftar program itu (ditambah pendaftar yang belum memilih program).
alter table public.profil add column if not exists program_ppdb text not null default '';
alter table public.profil drop constraint if exists profil_program_ppdb_cek;
alter table public.profil add constraint profil_program_ppdb_cek check (program_ppdb in ('', 'tahfizh', 'takhassus'));

create or replace function public.kode_program(p text) returns text
language sql immutable as $$
  select case when coalesce(p, '') ilike '%takh%' then 'takhassus' when coalesce(p, '') ilike '%tahf%' then 'tahfizh' else '' end
$$;
-- Program akun yang sedang masuk ('' = semua program; Admin selalu semua program)
create or replace function public.program_saya() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select case when '*' = any(r.akses) then '' else p.program_ppdb end
    from public.profil p join public.peran r on r.kode = p.peran where p.id = auth.uid()), '')
$$;
create or replace function public.boleh_program(p_program text) returns boolean
language sql stable set search_path = public as $$
  select public.program_saya() = '' or public.kode_program(p_program) in ('', public.program_saya())
$$;
create or replace function public.panitia_program(p_program text) returns boolean
language sql stable set search_path = public as $$
  select public.boleh('pendaftar') and public.boleh_program(p_program)
$$;
-- Panitia semua program: boleh mengubah pengaturan bersama (komponen nilai, batas lulus, berkas syarat)
create or replace function public.panitia_pusat() returns boolean
language sql stable set search_path = public as $$
  select public.boleh('pendaftar') and public.program_saya() = ''
$$;
create or replace function public.panitia_untuk(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.boleh('pendaftar') and (public.program_saya() = '' or exists (
    select 1 from public.pendaftar p where p.id = p_id and public.boleh_program(p.program)))
$$;
create or replace function public.penilai_untuk(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (public.boleh('pendaftar') or public.boleh('nilai_ppdb')) and (public.program_saya() = '' or exists (
    select 1 from public.pendaftar p where p.id = p_id and public.boleh_program(p.program)))
$$;
-- Berkas di bucket "ppdb" disimpan di folder <id pendaftar>/...
create or replace function public.panitia_berkas(p_nama text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  f text := split_part(coalesce(p_nama, ''), '/', 1);
begin
  if not public.boleh('pendaftar') then return false; end if;
  if public.program_saya() = '' then return true; end if;
  if f !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  return public.panitia_untuk(f::uuid);
end $$;

-- Peran siap pakai: atur programnya per akun di Pengguna
insert into public.peran (kode, nama, akses, urutan) values ('ketua_ppdb', 'Ketua Panitia PPDB', array['pendaftar', 'nilai_ppdb'], 25)
on conflict (kode) do nothing;

-- ---------- 4. Keamanan (Row Level Security) ----------
alter table public.pendaftar enable row level security;
alter table public.ppdb_rahasia enable row level security;
revoke all on public.pendaftar, public.ppdb_rahasia from anon;
grant select, insert, update, delete on public.pendaftar to authenticated;
grant select, insert, update on public.ppdb_rahasia to authenticated;
grant usage on sequence public.pendaftar_urut to authenticated;

drop policy if exists "pendaftar dibaca" on public.pendaftar;
create policy "pendaftar dibaca" on public.pendaftar for select to authenticated
  using (id = auth.uid() or public.panitia_program(program));
drop policy if exists "pendaftar ditambah" on public.pendaftar;
create policy "pendaftar ditambah" on public.pendaftar for insert to authenticated
  with check ((id = auth.uid() and coalesce(auth.jwt()->'user_metadata'->>'jenis', '') = 'pendaftar') or public.panitia_program(program));
drop policy if exists "pendaftar diubah" on public.pendaftar;
create policy "pendaftar diubah" on public.pendaftar for update to authenticated
  using (id = auth.uid() or public.panitia_program(program)) with check (id = auth.uid() or public.panitia_program(program));
drop policy if exists "pendaftar dihapus panitia" on public.pendaftar;
create policy "pendaftar dihapus panitia" on public.pendaftar for delete to authenticated
  using (public.panitia_program(program));

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
  using (bucket_id = 'ppdb' and ((storage.foldername(name))[1] = auth.uid()::text or public.panitia_berkas(name)));
drop policy if exists "ppdb dihapus panitia" on storage.objects;
create policy "ppdb dihapus panitia" on storage.objects for delete to authenticated
  using (bucket_id = 'ppdb' and public.panitia_berkas(name));

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
  with check (public.panitia_pusat());
drop policy if exists "penilaian diubah panitia" on public.ppdb_penilaian;
create policy "penilaian diubah panitia" on public.ppdb_penilaian for update to authenticated
  using (public.panitia_pusat()) with check (public.panitia_pusat());
drop policy if exists "nilai panitia" on public.pendaftar_nilai;
drop policy if exists "nilai dibaca" on public.pendaftar_nilai;
create policy "nilai dibaca" on public.pendaftar_nilai for select to authenticated
  using (public.penilai_untuk(id));
drop policy if exists "nilai diisi" on public.pendaftar_nilai;
create policy "nilai diisi" on public.pendaftar_nilai for insert to authenticated
  with check (public.penilai_untuk(id));
drop policy if exists "nilai diubah" on public.pendaftar_nilai;
create policy "nilai diubah" on public.pendaftar_nilai for update to authenticated
  using (public.penilai_untuk(id)) with check (public.penilai_untuk(id));
drop policy if exists "nilai dihapus panitia" on public.pendaftar_nilai;
create policy "nilai dihapus panitia" on public.pendaftar_nilai for delete to authenticated
  using (public.panitia_untuk(id));

-- Daftar peserta tes untuk penguji: hanya nomor, nama, dan pilihan sekolah (tanpa biodata/kontak/berkas)
create or replace function public.peserta_tes()
returns table (id uuid, nomor text, nama text, jenjang text, program text, status_bayar text, wawancara_lengkap boolean, dibuat timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.nomor, p.nama, p.jenjang, p.program, p.status_bayar, p.wawancara_lengkap, p.dibuat
  from public.pendaftar p
  where (public.boleh('pendaftar') or public.boleh('nilai_ppdb')) and public.boleh_program(p.program)
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
  if not public.panitia_untuk(p_pendaftar) then raise exception 'Akses ditolak.'; end if;
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
  with check (public.panitia_pusat());
drop policy if exists "syarat diubah panitia" on public.ppdb_syarat;
create policy "syarat diubah panitia" on public.ppdb_syarat for update to authenticated
  using (public.panitia_pusat()) with check (public.panitia_pusat());

drop policy if exists "berkas dibaca" on public.pendaftar_berkas;
create policy "berkas dibaca" on public.pendaftar_berkas for select to authenticated
  using (pendaftar = auth.uid() or public.panitia_untuk(pendaftar));
drop policy if exists "berkas diunggah" on public.pendaftar_berkas;
create policy "berkas diunggah" on public.pendaftar_berkas for insert to authenticated
  with check (pendaftar = auth.uid() or public.panitia_untuk(pendaftar));
drop policy if exists "berkas diubah" on public.pendaftar_berkas;
create policy "berkas diubah" on public.pendaftar_berkas for update to authenticated
  using (pendaftar = auth.uid() or public.panitia_untuk(pendaftar)) with check (pendaftar = auth.uid() or public.panitia_untuk(pendaftar));
drop policy if exists "berkas dihapus panitia" on public.pendaftar_berkas;
create policy "berkas dihapus panitia" on public.pendaftar_berkas for delete to authenticated
  using (public.panitia_untuk(pendaftar));

drop policy if exists "tagihan dibaca" on public.tagihan;
create policy "tagihan dibaca" on public.tagihan for select to authenticated
  using (akun = auth.uid() or public.panitia_untuk(akun));
drop policy if exists "tagihan dikelola panitia" on public.tagihan;
create policy "tagihan dikelola panitia" on public.tagihan for all to authenticated
  using (public.panitia_untuk(akun)) with check (public.panitia_untuk(akun));

drop policy if exists "pembayaran dibaca" on public.pembayaran;
create policy "pembayaran dibaca" on public.pembayaran for select to authenticated
  using (exists (select 1 from public.tagihan t where t.id = pembayaran.tagihan and (t.akun = auth.uid() or public.panitia_untuk(t.akun))));
drop policy if exists "pembayaran dikelola panitia" on public.pembayaran;
create policy "pembayaran dikelola panitia" on public.pembayaran for all to authenticated
  using (exists (select 1 from public.tagihan t where t.id = pembayaran.tagihan and public.panitia_untuk(t.akun)))
  with check (exists (select 1 from public.tagihan t where t.id = pembayaran.tagihan and public.panitia_untuk(t.akun)));

-- Teks bawaan langkah 09 di dashboard calon santri (hanya diganti jika belum pernah diubah)
update public.konten k
set data = jsonb_set(k.data, '{online,info_tes_akhir}', to_jsonb('Tes Tahap Akhir hanya untuk calon santri yang lulus Tes Tahap Awal: pemeriksaan hasil kesehatan serta wawancara calon santri dan ibu calon santri. Lengkapi berkas syarat lulus di bawah ini: unduh formatnya (jika ada), isi, lalu unggah.'::text)),
    diubah = now()
where k.kunci = 'ppdb'
  and k.data->'online'->>'info_tes_akhir' = 'Tes Tahap Akhir hanya untuk calon santri yang lulus Tes Tahap Awal: pemeriksaan hasil kesehatan serta wawancara calon santri dan ibu calon santri. Unggah surat hasil pemeriksaan kesehatan di bawah ini.';
