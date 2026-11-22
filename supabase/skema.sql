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
