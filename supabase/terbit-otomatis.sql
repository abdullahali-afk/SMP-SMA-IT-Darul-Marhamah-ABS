-- =====================================================================
--  Penerbitan otomatis: setiap kali isi/berita disimpan di Panel Admin,
--  Supabase langsung meminta GitHub memperbarui website (±2–3 menit).
--
--  Cara pakai (sekali saja):
--  1. Buat token GitHub (lihat README bagian "Penerbitan otomatis").
--  2. Ganti tulisan TEMPEL_TOKEN_GITHUB_DI_SINI di bawah dengan token itu.
--  3. Supabase → SQL Editor → New query → tempel seluruh file ini → Run.
--  Token disimpan terenkripsi di Supabase Vault. Jangan kirim token ke siapa pun.
--  Aman dijalankan ulang (misalnya saat mengganti token yang kedaluwarsa).
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- 1. Simpan / perbarui token di Vault
do $$
declare
  token text := 'TEMPEL_TOKEN_GITHUB_DI_SINI';
  sid uuid;
begin
  if token = '' or token like 'TEMPEL_%' then
    raise exception 'Ganti TEMPEL_TOKEN_GITHUB_DI_SINI dengan token GitHub Anda terlebih dahulu.';
  end if;
  select id into sid from vault.secrets where name = 'github_token_sinkron';
  if sid is null then
    perform vault.create_secret(token, 'github_token_sinkron', 'Token GitHub untuk menerbitkan website dari Panel Admin');
  else
    perform vault.update_secret(sid, token);
  end if;
end $$;

-- 2. Fungsi yang meminta GitHub menjalankan "Sinkron panel admin"
create or replace function public.picu_sinkron() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tok text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_token_sinkron' limit 1;
  if coalesce(tok, '') <> '' then
    perform net.http_post(
      url := 'https://api.github.com/repos/abdullahali-afk/SMP-SMA-IT-Darul-Marhamah-ABS/actions/workflows/sinkron.yml/dispatches',
      body := jsonb_build_object('ref', 'main'),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || tok,
        'Accept', 'application/vnd.github+json',
        'Content-Type', 'application/json',
        'User-Agent', 'panel-admin-darul-marhamah',
        'X-GitHub-Api-Version', '2022-11-28'),
      timeout_milliseconds := 5000);
  end if;
  return null;
end $$;

revoke execute on function public.picu_sinkron() from public, anon, authenticated;

-- 3. Jalankan setiap ada perubahan isi website atau berita
drop trigger if exists terbit_konten on public.konten;
create trigger terbit_konten after insert or update or delete on public.konten
  for each statement execute function public.picu_sinkron();

drop trigger if exists terbit_berita on public.berita;
create trigger terbit_berita after insert or update or delete on public.berita
  for each statement execute function public.picu_sinkron();

-- 4. Cek: setelah Run, simpan sesuatu di Panel Admin, lalu jalankan
--    select status_code, content from net._http_response order by created desc limit 3;
--    Kode 204 berarti berhasil. 401/403/404 berarti token salah atau izinnya kurang.
