// Menyalin isi website dari database panel admin (Supabase) ke file website.
//   konten  -> _data/<kunci>.json
//   berita  -> _posts/<tanggal>-<slug>.html  (hanya yang diterbitkan)
// Dijalankan otomatis oleh .github/workflows/sinkron.yml. Bisa juga manual:
//   node scripts/sinkron.mjs
// Hanya memakai kunci publik (publishable/anon), sama seperti panel admin.
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'admin/konfigurasi.json'), 'utf8'));
const URL_DB = (process.env.SUPABASE_URL || cfg.url || '').replace(/\/+$/, '');
const KUNCI_API = process.env.SUPABASE_KEY || cfg.anonKey || '';

if (!URL_DB || !KUNCI_API) {
  console.log('Panel admin belum tersambung (admin/konfigurasi.json kosong). Lewati.');
  process.exit(0);
}

async function ambil(q) {
  const r = await fetch(`${URL_DB}/rest/v1/${q}`, { headers: { apikey: KUNCI_API, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

/* ---------- Pembersih HTML (cegah skrip berbahaya ikut tampil di website) ---------- */
const TAG_BAHAYA = 'script|style|iframe|frame|frameset|object|embed|applet|form|meta|link|base|svg|math|template';
function urlBahaya(v) {
  const t = String(v)
    .replace(/&#x([0-9a-f]+);?/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&colon;/gi, ':').replace(/&(tab|newline);/gi, '')
    .replace(/[\s\u0000-\u001f]+/g, '').toLowerCase();
  return /^(javascript|vbscript|livescript):/.test(t) || (/^data:/.test(t) && !/^data:image\/(png|jpe?g|gif|webp);/.test(t));
}
function bersihkanTag(tag) {
  return tag
    .replace(/[\s/]+on[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' ')
    .replace(/[\s/]+(srcdoc|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' ')
    .replace(/(\s)(href|src|action|background|poster)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      (m, sp, attr, _v, a, b, c) => urlBahaya(a ?? b ?? c ?? '') ? `${sp}${attr}="#"` : m);
}
export function bersihkanHtml(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(new RegExp(`<\\s*(${TAG_BAHAYA})\\b[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, 'gi'), '')
    .replace(new RegExp(`<\\s*\\/?\\s*(${TAG_BAHAYA})\\b(?:"[^"]*"|'[^']*'|[^'">])*>?`, 'gi'), '')
    .replace(/<[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g, bersihkanTag);
}
function bersihkanNilai(v) {
  if (typeof v === 'string') {
    if (urlBahaya(v)) return '#';
    return v.includes('<') ? bersihkanHtml(v) : v;
  }
  if (Array.isArray(v)) return v.map(bersihkanNilai);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (k !== '__baru') o[k] = bersihkanNilai(x);
    return o;
  }
  return v;
}
// Teks dari editor tidak boleh dibaca sebagai perintah Liquid oleh Jekyll
const amankanLiquid = (s) => String(s).replace(/\{([{%])/g, '&#123;$1').replace(/([%}])\}/g, '$1&#125;');

/* ---------- Lokasi Google Maps (isian "peta") ---------- */
await import(pathToFileURL(path.join(ROOT, 'admin/peta.js')).href);
const { bacaPeta, petaDariAlamat } = globalThis;

// Link pendek (maps.app.goo.gl, vt.tiktok.com, fb.watch) dibuka untuk mendapatkan alamat lengkapnya
async function bukaLinkPendek(url, baca = bacaPeta) {
  let u = url;
  for (let i = 0; i < 6; i++) {
    let r;
    try { r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'curl/8.5.0' } }); }
    catch (e) { return null; }
    let lok = r.headers.get('location');
    if (!lok && r.status === 200) {
      const html = await r.text().catch(() => '');
      const m = html.match(/https:\/\/(?:www\.)?google\.[a-z.]+\/maps\/[^"'<>\s\\]+/);
      lok = m && m[0].replace(/&amp;/g, '&');
    }
    if (!lok) return null;
    u = new URL(lok, u).href;
    const h = new URL(u);
    if (/^consent\./.test(h.hostname) && h.searchParams.get('continue')) u = h.searchParams.get('continue');
    const hasil = baca(u);
    if (hasil && !hasil.pendek) return u;
  }
  return null;
}
function tiapObjekPeta(o, f) {
  if (Array.isArray(o)) o.forEach(x => tiapObjekPeta(x, f));
  else if (o && typeof o === 'object') { if (typeof o.peta === 'string') f(o); Object.values(o).forEach(x => tiapObjekPeta(x, f)); }
}
const dariAlamat = (o) => petaDariAlamat(o.alamat || o.nama);
async function lengkapiPeta(data, lama) {
  // Hasil link pendek yang sudah pernah dibuka dipakai lagi (tidak membuka ulang tiap pemeriksaan)
  const simpan = new Map();
  if (lama) tiapObjekPeta(lama, o => {
    const b = bacaPeta(o.peta), cad = dariAlamat(o);
    if (b && b.pendek && o.peta_embed && (!cad || o.peta_embed !== cad.embed)) simpan.set(o.peta, { embed: o.peta_embed, link: o.peta_link });
  });
  const tugas = [];
  tiapObjekPeta(data, o => tugas.push(o));
  for (const o of tugas) {
    let r = simpan.get(o.peta) || bacaPeta(o.peta);
    if (r && r.pendek) {
      const asli = await bukaLinkPendek(r.link);
      const r2 = asli && bacaPeta(asli);
      const cad = dariAlamat(o);
      if (r2 && !r2.pendek) r = { embed: r2.embed, link: r.link };
      else { console.log('  link Google Maps belum bisa dibuka, sementara memakai alamat:', o.peta); r = cad ? { embed: cad.embed, link: r.link } : null; }
    }
    if (!r) r = dariAlamat(o);
    if (r) { o.peta_embed = r.embed; o.peta_link = r.link; }
    else { delete o.peta_embed; delete o.peta_link; }
  }
}

/* ---------- Video testimoni (isian "video") ---------- */
await import(pathToFileURL(path.join(ROOT, 'admin/video.js')).href);
const { bacaVideo } = globalThis;
const KOLOM_VIDEO = ['video_embed', 'video_link', 'video_jenis', 'video_tegak', 'video_gambar'];
function tiapObjekVideo(o, f) {
  if (Array.isArray(o)) o.forEach(x => tiapObjekVideo(x, f));
  else if (o && typeof o === 'object') { if (typeof o.video === 'string') f(o); Object.values(o).forEach(x => tiapObjekVideo(x, f)); }
}
async function lengkapiVideo(data, lama) {
  const simpan = new Map();
  if (lama) tiapObjekVideo(lama, o => { const b = bacaVideo(o.video); if (b && b.pendek && o.video_embed) simpan.set(o.video, o); });
  const tugas = [];
  tiapObjekVideo(data, o => tugas.push(o));
  for (const o of tugas) {
    KOLOM_VIDEO.forEach(k => delete o[k]);
    let r = bacaVideo(o.video);
    if (r && r.pendek) {
      const lamaO = simpan.get(o.video);
      if (lamaO) { KOLOM_VIDEO.forEach(k => { if (lamaO[k] !== undefined) o[k] = lamaO[k]; }); continue; }
      const asli = await bukaLinkPendek(r.link, bacaVideo);
      const r2 = asli && bacaVideo(asli);
      if (r2 && !r2.pendek) r = { ...r2, link: r.link };
      else { console.log('  link video belum bisa dibuka, ditampilkan sebagai tombol:', o.video); o.video_link = r.link; continue; }
    }
    if (!r) { if (/^https?:\/\//i.test(o.video.trim())) o.video_link = o.video.trim(); continue; }
    o.video_embed = r.embed; o.video_link = r.link; o.video_jenis = r.jenis; o.video_tegak = !!r.tegak;
    if (r.gambar) o.video_gambar = r.gambar;
  }
}

/* ---------- Tulis file hanya jika isinya berubah ---------- */
let berubah = 0;
async function tulis(rel, isi) {
  const p = path.join(ROOT, rel);
  let lama = null;
  try { lama = await readFile(p, 'utf8'); } catch {}
  if (lama === isi) return;
  await writeFile(p, isi);
  berubah++; console.log('  ditulis', rel);
}
async function hapus(rel) {
  try { await unlink(path.join(ROOT, rel)); berubah++; console.log('  dihapus', rel); } catch {}
}

/* ---------- Isian baru yang belum pernah disimpan dari panel ---------- */
// scripts/bawaan.json berisi nilai awal untuk isian yang ditambahkan belakangan ke suatu bagian.
// Nilai itu dipakai selama isian tersebut belum ada di database (belum pernah disimpan dari panel).
let BAWAAN = {};
try { BAWAAN = JSON.parse(await readFile(path.join(ROOT, 'scripts/bawaan.json'), 'utf8')); } catch {}
function lengkapiBawaan(kunci, data) {
  const b = BAWAAN[kunci];
  if (!b || typeof b !== 'object') return;
  for (const [k, v] of Object.entries(b)) if (data[k] === undefined) data[k] = JSON.parse(JSON.stringify(v));
}

/* ---------- 1. Isi halaman (_data) ---------- */
try {
  const rows = await ambil('konten?select=kunci,data');
  console.log(`Konten: ${rows.length} bagian`);
  for (const { kunci, data } of rows) {
    if (!/^[a-z0-9_-]{1,40}$/.test(kunci)) { console.log('  lewati kunci tidak sah:', kunci); continue; }
    if (!data || typeof data !== 'object' || !Object.keys(data).length) continue;
    let lama = null;
    try { lama = JSON.parse(await readFile(path.join(ROOT, `_data/${kunci}.json`), 'utf8')); } catch {}
    lengkapiBawaan(kunci, data);
    await lengkapiPeta(data, lama);
    await lengkapiVideo(data, lama);
    await tulis(`_data/${kunci}.json`, JSON.stringify(bersihkanNilai(data), null, 2) + '\n');
    await hapus(`_data/${kunci}.yml`);
    await hapus(`_data/${kunci}.yaml`);
  }
} catch (e) {
  console.log('Konten tidak diambil (database belum disiapkan?):', e.message);
}

/* ---------- 2. Berita (_posts) ---------- */
const slugify = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'berita';
const yamlStr = (s) => JSON.stringify(String(s ?? ''));
const teksPolos = (s) => String(s ?? '').replace(/<[^>]*>?/g, '').replace(/\{([{%])/g, '{ $1');

try {
  const rows = await ambil('berita?select=id,judul,slug,tanggal,kategori,gambar,ringkasan,isi&terbit=eq.true&order=tanggal.desc,dibuat.desc');
  console.log(`Berita: ${rows.length} terbit`);
  const ingin = new Map();
  for (const b of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.tanggal || '')) continue;
    const dasar = `${b.tanggal}-${slugify(b.slug || b.judul)}`;
    let nama = `${dasar}.html`, n = 2;
    while (ingin.has(nama)) nama = `${dasar}-${n++}.html`;
    const isi = [
      '---',
      `title: ${yamlStr(teksPolos(b.judul))}`,
      `date: ${b.tanggal}`,
      `kategori: ${yamlStr(teksPolos(b.kategori) || 'Kegiatan')}`,
      `gambar: ${yamlStr(urlBahaya(b.gambar || '') ? '' : b.gambar)}`,
      `ringkasan: ${yamlStr(teksPolos(b.ringkasan))}`,
      `id_berita: ${yamlStr(b.id)}`,
      '---',
      amankanLiquid(bersihkanHtml(b.isi || '')),
      ''].join('\n');
    ingin.set(nama, isi);
  }
  const ada = (await readdir(path.join(ROOT, '_posts'))).filter(f => /^\d{4}-\d{2}-\d{2}-.+\.(md|markdown|html)$/.test(f));
  for (const f of ada) if (!ingin.has(f)) await hapus(`_posts/${f}`);
  for (const [nama, isi] of ingin) await tulis(`_posts/${nama}`, isi);
} catch (e) {
  console.log('Berita tidak diambil (database belum disiapkan?):', e.message);
}

console.log(berubah ? `Selesai: ${berubah} file berubah.` : 'Selesai: tidak ada perubahan.');
