/* Membaca link video apa pun bentuknya dan mengubahnya menjadi pemutar di website.
 * Didukung: YouTube (biasa, Shorts, youtu.be, live), Google Drive, Instagram (post/reel),
 * TikTok, Facebook (video/reel), dan file video langsung (.mp4/.webm/.mov).
 * Hasil: { jenis, embed, link, tegak, gambar } | { pendek: true, link } (dibuka oleh scripts/sinkron.mjs) | null.
 * Dipakai oleh panel admin (browser) dan scripts/sinkron.mjs (Node). */
(function (g) {
  const enc = encodeURIComponent;
  function bacaVideo(teks) {
    let t = String(teks == null ? '' : teks).trim();
    if (!t) return null;
    const ifr = t.match(/<iframe[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i);
    if (ifr) t = ifr[1].replace(/&amp;/g, '&').trim();
    if (/^[\w-]{11}$/.test(t)) t = 'https://youtu.be/' + t;
    if (!/^https?:\/\//i.test(t)) { if (/^(www\.|m\.|youtu|vt\.|vm\.|fb\.|drive\.|instagram|tiktok|facebook)/i.test(t)) t = 'https://' + t; else return null; }
    let u; try { u = new URL(t); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, '');
    const p = u.pathname;

    // YouTube
    if (/^(youtube\.com|youtube-nocookie\.com|youtu\.be|music\.youtube\.com)$/.test(host)) {
      let id = '', tegak = false;
      if (host === 'youtu.be') id = p.split('/')[1] || '';
      else if (u.searchParams.get('v')) id = u.searchParams.get('v');
      else { const m = p.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/); if (m) { id = m[2]; tegak = m[1] === 'shorts'; } }
      if (!/^[\w-]{11}$/.test(id)) return null;
      return { jenis: 'youtube', tegak, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`,
        link: tegak ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`, gambar: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    }
    // Google Drive (file harus dibagikan "Siapa saja yang memiliki link")
    if (host === 'drive.google.com' || host === 'docs.google.com') {
      const m = p.match(/\/file\/d\/([\w-]{10,})/); const id = m ? m[1] : (u.searchParams.get('id') || '');
      if (!/^[\w-]{10,}$/.test(id)) return null;
      return { jenis: 'drive', tegak: false, embed: `https://drive.google.com/file/d/${id}/preview`, link: `https://drive.google.com/file/d/${id}/view` };
    }
    // Instagram
    if (host === 'instagram.com') {
      const m = p.match(/^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
      if (!m) return null;
      const jenis = m[1] === 'p' ? 'p' : 'reel';
      return { jenis: 'instagram', tegak: true, embed: `https://www.instagram.com/${jenis}/${m[2]}/embed/`, link: `https://www.instagram.com/${jenis}/${m[2]}/` };
    }
    // TikTok
    if (/^(vt|vm)\.tiktok\.com$/.test(host) || (host === 'tiktok.com' && /^\/t\//.test(p))) return { pendek: true, link: 'https://' + u.hostname + p };
    if (host === 'tiktok.com') {
      const m = p.match(/\/video\/(\d{8,})/) || p.match(/\/embed\/(?:v2\/)?(\d{8,})/);
      if (!m) return null;
      return { jenis: 'tiktok', tegak: true, embed: `https://www.tiktok.com/embed/v2/${m[1]}`, link: 'https://www.tiktok.com' + p };
    }
    // Facebook
    if (host === 'fb.watch') return { pendek: true, link: 'https://fb.watch' + p };
    if (host === 'facebook.com' && /^\/share\/(v|r)\//.test(p)) return { pendek: true, link: 'https://www.facebook.com' + p };
    if (host === 'facebook.com') {
      if (p.startsWith('/plugins/video.php') && u.searchParams.get('href')) return bacaVideo(u.searchParams.get('href'));
      if (!/\/(videos|reel|watch)\b/.test(p) && !u.searchParams.get('v')) return null;
      const asli = 'https://www.facebook.com' + p + (u.searchParams.get('v') ? '?v=' + u.searchParams.get('v') : '');
      return { jenis: 'facebook', tegak: /\/reel\b/.test(p),
        embed: `https://www.facebook.com/plugins/video.php?href=${enc(asli)}&show_text=false`, link: asli };
    }
    // File video langsung (mis. diunggah ke penyimpanan)
    if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(p)) return { jenis: 'file', tegak: false, embed: u.href, link: u.href };
    return null;
  }
  g.bacaVideo = bacaVideo;
})(typeof window !== 'undefined' ? window : globalThis);
