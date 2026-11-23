/* Membaca isian "Lokasi Google Maps" apa pun bentuknya:
 *  - link dari tombol Bagikan Google Maps (maps.app.goo.gl/…, google.com/maps/place/…)
 *  - kode sematan "Sematkan peta" (<iframe src="https://www.google.com/maps/embed?pb=…">)
 *  - koordinat (-5.13, 119.48) atau alamat biasa
 * Hasil: { embed, link } atau { pendek: true, link } untuk link pendek
 * (link pendek dibuka oleh scripts/sinkron.mjs saat menerbitkan).
 * Dipakai oleh panel admin (browser) dan scripts/sinkron.mjs (Node). */
(function (g) {
  const EMBED = 'https://www.google.com/maps?output=embed&z=17&q=';
  const CARI = 'https://www.google.com/maps/search/?api=1&query=';
  const dariQ = (q) => ({ embed: EMBED + encodeURIComponent(q), link: CARI + encodeURIComponent(q) });
  const urai = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const angka = (s) => /^-?\d{1,3}(\.\d+)?$/.test(s);

  function bacaPeta(teks) {
    let t = String(teks == null ? '' : teks).trim();
    if (!t) return null;
    const ifr = t.match(/<iframe[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i);
    if (ifr) t = ifr[1].replace(/&amp;/g, '&').trim();
    else if (/^<|<\s*\/?\s*iframe/i.test(t)) return null;

    const k = t.match(/^\(?\s*(-?\d{1,2}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)\s*\)?$/);
    if (k) return dariQ(k[1] + ',' + k[2]);

    let u = null;
    const mirip = /^(https?:\/\/|www\.|maps\.|goo\.gl\/|g\.co\/)/i.test(t);
    if (mirip) { try { u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); } catch (e) { return null; } }
    if (!u) return /[a-z]/i.test(t) && t.length <= 300 ? dariQ(t.replace(/\s+/g, ' ')) : null;

    const host = u.hostname.toLowerCase();
    if (/^(maps\.app\.goo\.gl|goo\.gl|g\.co)$/.test(host)) return { pendek: true, link: 'https://' + host + u.pathname + u.search };
    const google = /(^|\.)google\.(com|co\.id|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host);
    if (!google || !(u.pathname.startsWith('/maps') || host.startsWith('maps.'))) return null;

    const isi = urai(u.pathname + u.search + u.hash);
    // Kode sematan resmi: pakai apa adanya
    if (u.pathname.startsWith('/maps/embed') && u.searchParams.get('pb')) {
      const lat = isi.match(/!3d(-?\d+\.\d+)/), lng = isi.match(/!2d(-?\d+\.\d+)/);
      return { embed: 'https://www.google.com/maps/embed' + u.search,
        link: lat && lng ? CARI + lat[1] + ',' + lng[1] : 'https://www.google.com/maps' };
    }
    const link = 'https://www.google.com' + u.pathname + u.search;
    // Titik tempat yang dipilih (paling tepat)
    const p3 = isi.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (p3) return { embed: dariQ(p3[1] + ',' + p3[2]).embed, link };
    const tempat = u.pathname.match(/\/maps\/place\/([^/]+)/);
    if (tempat && !tempat[1].startsWith('@')) {
      const nama = urai(tempat[1].replace(/\+/g, ' ')).trim();
      if (nama) return { embed: dariQ(nama).embed, link };
    }
    for (const kunci of ['q', 'query', 'daddr', 'destination', 'll']) {
      const v = u.searchParams.get(kunci);
      if (v && v.trim()) return { embed: dariQ(v.trim()).embed, link };
    }
    const at = isi.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at && angka(at[1]) && angka(at[2])) return { embed: dariQ(at[1] + ',' + at[2]).embed, link };
    const cari = u.pathname.match(/\/maps\/search\/([^/@]+)/);
    if (cari) return { embed: dariQ(urai(cari[1].replace(/\+/g, ' '))).embed, link };
    return null;
  }
  g.bacaPeta = bacaPeta;
  g.petaDariAlamat = (a) => (String(a || '').trim() ? dariQ(String(a).trim()) : null);
})(typeof window !== 'undefined' ? window : globalThis);
