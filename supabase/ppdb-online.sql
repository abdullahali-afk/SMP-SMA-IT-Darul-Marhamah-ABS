-- =====================================================================
--  PPDB ONLINE — akun calon santri, berkas, dan status seleksi
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
