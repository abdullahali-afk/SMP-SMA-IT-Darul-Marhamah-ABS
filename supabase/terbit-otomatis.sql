-- =====================================================================
--  PENERBITAN OTOMATIS — LANGKAH 1 dari 2
--  Tempel SELURUH isi file ini di Supabase → SQL Editor → New query → Run.
--  Tidak perlu mengubah apa pun di file ini.
--
--  LANGKAH 2 (query baru, satu baris saja):
--    select public.atur_token_terbit('TOKEN_GITHUB_ANDA');
--  Ganti TOKEN_GITHUB_ANDA dengan token GitHub (diawali github_pat_),
--  tanda kutip ' di kiri dan kanan token harus tetap ada.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- Menyimpan / mengganti token GitHub di Supabase Vault (terenkripsi)
create or replace function public.atur_token_terbit(token text) returns text
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  token := btrim(coalesce(token, ''));
  if token = '' or token = 'TOKEN_GITHUB_ANDA' then
    raise exception 'Token belum diisi. Ganti TOKEN_GITHUB_ANDA dengan token GitHub Anda.';
  end if;
  if token not like 'github_pat_%' and token not like 'ghp_%' then
    raise exception 'Itu bukan token GitHub. Token GitHub diawali github_pat_';
  end if;
  select id into sid from vault.secrets where name = 'github_token_sinkron' limit 1;
  if sid is null then
    perform vault.create_secret(token, 'github_token_sinkron', 'Token GitHub untuk menerbitkan website dari Panel Admin');
  else
    perform vault.update_secret(sid, token);
  end if;
  return 'Berhasil. Token tersimpan dan penerbitan otomatis aktif.';
end $$;

revoke execute on function public.atur_token_terbit(text) from public, anon, authenticated;

-- Meminta GitHub menjalankan "Sinkron panel admin"
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

-- Jalankan setiap ada perubahan isi website atau berita
drop trigger if exists terbit_konten on public.konten;
create trigger terbit_konten after insert or update or delete on public.konten
  for each statement execute function public.picu_sinkron();

drop trigger if exists terbit_berita on public.berita;
create trigger terbit_berita after insert or update or delete on public.berita
  for each statement execute function public.picu_sinkron();
