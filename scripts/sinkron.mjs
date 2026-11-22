// Menyalin isi website dari database panel admin (Supabase) ke file website.
//   konten  -> _data/<kunci>.json
//   berita  -> _posts/<tanggal>-<slug>.html  (hanya yang diterbitkan)
// Dijalankan otomatis oleh .github/workflows/sinkron.yml. Bisa juga manual:
//   node scripts/sinkron.mjs
// Hanya memakai kunci publik (publishable/anon), sama seperti panel admin.
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/* ---------- 1. Isi halaman (_data) ---------- */
try {
  const rows = await ambil('konten?select=kunci,data');
  console.log(`Konten: ${rows.length} bagian`);
  for (const { kunci, data } of rows) {
    if (!/^[a-z0-9_-]{1,40}$/.test(kunci)) { console.log('  lewati kunci tidak sah:', kunci); continue; }
    if (!data || typeof data !== 'object' || !Object.keys(data).length) continue;
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
