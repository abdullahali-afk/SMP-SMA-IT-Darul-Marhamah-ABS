"""Membuat supabase/setup.sql = skema.sql + isi awal dari _data/*.yml dan _posts/.
Jalankan: python3 scripts/buat-sql-awal.py"""
import json, os, re, glob, yaml, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KUNCI = ["menu","sekolah","beranda","ppdb","program","fasilitas","guru","struktur","galeri","testimoni","video","download"]
def q(s): return "$isi$" + s + "$isi$"
def conv(o):
    if isinstance(o,(datetime.date,datetime.datetime)): return o.isoformat()
    raise TypeError
out = [open(os.path.join(ROOT,"supabase/skema.sql")).read(), "\n-- ---------- 7. Isi awal website (tidak menimpa isi yang sudah ada) ----------"]
for k in KUNCI:
    f = os.path.join(ROOT,"_data",k+".yml")
    data = yaml.safe_load(open(f)) if os.path.exists(f) else json.load(open(os.path.join(ROOT,"_data",k+".json")))
    out.append(f"insert into public.konten (kunci, data) values ('{k}', {q(json.dumps(data, ensure_ascii=False, default=conv))}::jsonb) on conflict (kunci) do nothing;")
out.append("\ninsert into public.berita (judul, slug, tanggal, kategori, gambar, ringkasan, isi)\nselect * from (values")
rows=[]
for f in sorted(glob.glob(os.path.join(ROOT,"_posts","*.*"))):
    t = open(f).read(); m = re.match(r"---\n(.*?)\n---\n?(.*)", t, re.S)
    fm = yaml.safe_load(m.group(1)); body = m.group(2).strip()
    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", os.path.splitext(os.path.basename(f))[0])
    tgl = str(fm.get("date") or os.path.basename(f)[:10])[:10]
    if not body.lstrip().startswith("<"):
        body = "".join(f"<p>{p.strip()}</p>" for p in body.split("\n\n") if p.strip())
    rows.append(f"  ({q(fm['title'])}, {q(slug)}, '{tgl}'::date, {q(fm.get('kategori','Kegiatan'))}, {q(fm.get('gambar','') or '')}, {q(fm.get('ringkasan','') or '')}, {q(body)})")
out.append(",\n".join(rows))
out.append(") as v(judul, slug, tanggal, kategori, gambar, ringkasan, isi)\nwhere not exists (select 1 from public.berita);")
open(os.path.join(ROOT,"supabase/setup.sql"),"w").write("\n".join(out)+"\n")
print("ok", len(out))
