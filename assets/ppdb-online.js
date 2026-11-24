/* PPDB Online — halaman calon santri (/pendaftaran/)
 * Akun calon santri memakai Supabase Auth (sesi disimpan terpisah dari Panel Admin).
 * Data: tabel public.pendaftar, berkas di bucket privat "ppdb" (lihat supabase/ppdb-online.sql). */
(function () {
  'use strict';
  const D = JSON.parse(document.getElementById('data-ppdb').textContent || '{}');
  const P = D.ppdb || {};
  const ON = P.online || {};
  const root = document.getElementById('portal');
  const BUCKET = 'ppdb';
  let sb = null, sesi = null, saya = null, terbuka = null;

  /* ---------- Bantuan ---------- */
  function h(tag, attrs, ...anak) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const a of anak.flat()) if (a != null && a !== false) el.append(a.nodeType ? a : document.createTextNode(String(a)));
    return el;
  }
  const paragraf = (t) => String(t || '').split(/\n+/).filter(x => x.trim()).map(x => h('p', null, x));
  function toast(teks, galat) {
    let t = document.getElementById('po-toast');
    if (!t) { t = h('div', { id: 'po-toast', role: 'status' }); document.body.append(t); }
    t.textContent = teks; t.className = 'tampil' + (galat ? ' galat' : '');
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, galat ? 7000 : 3500);
  }
  function sibuk(btn, ya, teks) { btn.disabled = ya; if (teks) btn.textContent = teks; }
  function pesanGalat(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    const peta = {
      'Invalid login credentials': 'Email atau password salah.',
      'Email not confirmed': 'Email belum diverifikasi. Buka email Anda dan klik link verifikasi, lalu masuk lagi.',
      'User already registered': 'Email ini sudah terdaftar. Silakan masuk.',
      'Password should be at least 6 characters': 'Password minimal 6 karakter.',
      'Signups not allowed for this instance': 'Pembuatan akun sedang ditutup. Hubungi panitia PPDB.',
      'Error sending confirmation email': 'Email verifikasi gagal dikirim. Hubungi panitia PPDB.',
      'Error sending recovery email': 'Email reset password gagal dikirim. Hubungi panitia PPDB.',
    };
    if (peta[m]) return peta[m];
    if (/rate limit/i.test(m)) return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.';
    if (/jwt|token.*expired/i.test(m)) return 'Sesi login sudah habis. Silakan masuk lagi.';
    if (/row-level security|violates.*policy/i.test(m)) return 'Akses ditolak. Muat ulang halaman lalu coba lagi.';
    if (/exceeded the maximum allowed size|payload too large|413/i.test(m)) return 'File terlalu besar (maksimal 5 MB).';
    if (/mime type|not supported|invalid_mime/i.test(m)) return 'Jenis file tidak didukung. Gunakan foto JPG/PNG atau PDF.';
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) return 'Koneksi internet terputus. Periksa sinyal lalu coba lagi.';
    return m;
  }
  const tabelBelumAda = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message || ''));
  function nomorWa(n) { let d = String(n || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); return d; }
  function kontakPanitia() {
    const daftar = (D.wa || []).filter(x => x && x.nomor);
    const n = daftar.length ? daftar[0].nomor : D.wa_cadangan;
    if (!n) return null;
    const pesan = encodeURIComponent('Assalamu\'alaikum, saya ingin bertanya tentang PPDB Online' + (saya && saya.nomor ? ' (No. pendaftaran ' + saya.nomor + ')' : '') + '.');
    return h('a', { href: 'https://wa.me/' + nomorWa(n) + '?text=' + pesan, target: '_blank', rel: 'noopener' }, 'hubungi panitia via WhatsApp');
  }
  function bantuan() {
    const k = kontakPanitia();
    return h('p', { class: 'po-bantuan' }, 'Butuh bantuan? ', k || 'hubungi panitia PPDB', '.');
  }

  /* ---------- Mulai ---------- */
  async function mulai() {
    let cfg = {};
    try { cfg = await (await fetch(D.konfigurasi, { cache: 'no-store' })).json(); } catch (e) { /* abaikan */ }
    if (!cfg.url || !cfg.anonKey || !window.supabase) return tampilPesan('Sistem PPDB online belum tersambung. Silakan hubungi panitia PPDB.');
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { storageKey: 'sb-ppdb-calon-santri' } });
    sb.auth.onAuthStateChange((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY') { sesi = s; tampilGantiPassword(); }
      else if (ev === 'SIGNED_OUT') { sesi = null; saya = null; tampilMasuk('masuk'); }
    });
    const { data } = await sb.auth.getSession();
    sesi = data.session;
    if (/type=recovery/.test(location.hash)) return;
    if (sesi) return muatPendaftar();
    tampilMasuk(/daftar/.test(location.hash) ? 'daftar' : 'masuk');
  }

  function tampilPesan(teks, ...lain) {
    root.className = '';
    root.replaceChildren(h('div', { class: 'po-kotak po-tengah' }, h('div', { class: 'po-ikon' }, '📝'), ...paragraf(teks), ...lain, bantuan()));
  }

  /* ---------- Masuk / buat akun / lupa password ---------- */
  function tampilMasuk(mode, info) {
    root.className = '';
    const err = h('div');
    const galat = (t, jenis = 'galat') => err.replaceChildren(h('div', { class: 'po-pesan ' + jenis }, t));
    const tab = (m, teks) => h('button', { type: 'button', class: 'po-tab' + (mode === m ? ' aktif' : ''), onclick: () => tampilMasuk(m) }, teks);
    let isi;
    if (mode === 'daftar') {
      if (ON.dibuka === false) {
        isi = h('div', { class: 'po-pesan peringatan' }, 'Pembuatan akun calon santri sedang ditutup. Jika Anda sudah punya akun, silakan masuk.');
      } else {
        const nama = h('input', { type: 'text', required: true, maxlength: 120, autocomplete: 'name', placeholder: 'Nama lengkap calon santri' });
        const wa = h('input', { type: 'tel', required: true, maxlength: 20, autocomplete: 'tel', placeholder: '08xxxxxxxxxx' });
        const email = h('input', { type: 'email', required: true, autocomplete: 'email', placeholder: 'nama@email.com' });
        const pw = h('input', { type: 'password', required: true, minlength: 6, autocomplete: 'new-password' });
        const pw2 = h('input', { type: 'password', required: true, minlength: 6, autocomplete: 'new-password' });
        const btn = h('button', { class: 'btn btn-emas po-penuh', type: 'submit' }, 'Buat Akun');
        isi = h('form', { onsubmit: async (e) => {
          e.preventDefault();
          if (pw.value !== pw2.value) return galat('Kedua password tidak sama.');
          sibuk(btn, true, 'Memproses…');
          // Pastikan database PPDB sudah dipasang sebelum akun dibuat
          const cek = await sb.from('pendaftar').select('id').limit(1);
          if (cek.error && tabelBelumAda(cek.error)) { sibuk(btn, false, 'Buat Akun'); return galat('Sistem PPDB online belum diaktifkan oleh sekolah. Silakan coba lagi nanti atau hubungi panitia PPDB.'); }
          const { data, error } = await sb.auth.signUp({ email: email.value.trim(), password: pw.value,
            options: { data: { jenis: 'pendaftar', nama: nama.value.trim(), no_wa: wa.value.trim() }, emailRedirectTo: location.href.split('#')[0] } });
          sibuk(btn, false, 'Buat Akun');
          if (error) return galat(pesanGalat(error));
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return galat('Email ini sudah terdaftar. Silakan masuk.');
          if (data.session) { sesi = data.session; toast('Akun berhasil dibuat.'); return muatPendaftar(); }
          tampilMasuk('masuk', 'Akun berhasil dibuat. Kami sudah mengirim link verifikasi ke ' + email.value.trim() + '. Buka email tersebut (periksa juga folder Spam), klik link verifikasi, lalu masuk di sini.');
        } },
        h('div', null, h('label', null, 'Nama lengkap calon santri'), nama),
        h('div', null, h('label', null, 'No. WhatsApp orang tua/wali'), wa),
        h('div', null, h('label', null, 'Email aktif'), email, h('small', null, 'Gunakan email yang aktif. Informasi akun dikirim ke email ini.')),
        h('div', { class: 'po-dua' }, h('div', null, h('label', null, 'Password (min. 6 karakter)'), pw), h('div', null, h('label', null, 'Ulangi password'), pw2)),
        btn);
      }
    } else if (mode === 'lupa') {
      const email = h('input', { type: 'email', required: true, autocomplete: 'email' });
      const btn = h('button', { class: 'btn btn-hijau po-penuh', type: 'submit' }, 'Kirim link reset password');
      isi = h('form', { onsubmit: async (e) => {
        e.preventDefault(); sibuk(btn, true, 'Mengirim…');
        const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.href.split('#')[0] });
        sibuk(btn, false, 'Kirim link reset password');
        if (error) return galat(pesanGalat(error));
        galat('Jika email terdaftar, link untuk membuat password baru sudah dikirim. Periksa juga folder Spam.', 'info');
      } }, h('div', null, h('label', null, 'Email akun Anda'), email), btn,
      h('p', { class: 'po-kecil' }, 'Jika email tidak masuk, ', kontakPanitia() || 'hubungi panitia', ' untuk dibantu mengatur ulang password.'));
    } else {
      const email = h('input', { type: 'email', required: true, autocomplete: 'username', placeholder: 'nama@email.com' });
      const pw = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
      const btn = h('button', { class: 'btn btn-hijau po-penuh', type: 'submit' }, 'Masuk');
      isi = h('form', { onsubmit: async (e) => {
        e.preventDefault(); sibuk(btn, true, 'Memproses…');
        const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
        sibuk(btn, false, 'Masuk');
        if (error) return galat(pesanGalat(error));
        sesi = data.session; muatPendaftar();
      } }, h('div', null, h('label', null, 'Email'), email), h('div', null, h('label', null, 'Password'), pw), btn,
      h('p', { class: 'po-kecil' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); tampilMasuk('lupa'); } }, 'Lupa password?')));
    }
    root.replaceChildren(h('div', { class: 'po-kotak po-masuk' },
      h('div', { class: 'po-tabs' }, tab('masuk', 'Masuk (Login)'), tab('daftar', 'Buat Akun Baru')),
      mode === 'lupa' ? h('h2', null, 'Lupa password') : h('h2', null, mode === 'daftar' ? 'Buat akun calon santri' : 'Masuk ke sistem PPDB'),
      info ? h('div', { class: 'po-pesan info' }, info) : null, err, isi, bantuan()));
  }

  function tampilGantiPassword() {
    root.className = '';
    const pw = h('input', { type: 'password', required: true, minlength: 6, autocomplete: 'new-password' });
    const pw2 = h('input', { type: 'password', required: true, minlength: 6, autocomplete: 'new-password' });
    const err = h('div');
    const btn = h('button', { class: 'btn btn-hijau po-penuh', type: 'submit' }, 'Simpan password baru');
    root.replaceChildren(h('div', { class: 'po-kotak po-masuk' }, h('h2', null, 'Buat password baru'),
      h('form', { onsubmit: async (e) => {
        e.preventDefault();
        if (pw.value !== pw2.value) return err.replaceChildren(h('div', { class: 'po-pesan galat' }, 'Kedua password tidak sama.'));
        sibuk(btn, true, 'Menyimpan…');
        const { error } = await sb.auth.updateUser({ password: pw.value });
        sibuk(btn, false, 'Simpan password baru');
        if (error) return err.replaceChildren(h('div', { class: 'po-pesan galat' }, pesanGalat(error)));
        toast('Password berhasil diganti.');
        history.replaceState(null, '', location.pathname);
        const { data } = await sb.auth.getSession(); sesi = data.session; muatPendaftar();
      } }, h('div', null, h('label', null, 'Password baru'), pw), h('div', null, h('label', null, 'Ulangi password baru'), pw2), err, btn)));
  }

  /* ---------- Data pendaftar ---------- */
  async function muatPendaftar() {
    root.className = 'po-memuat'; root.textContent = 'Memuat data pendaftaran…';
    let { data, error } = await sb.from('pendaftar').select('*').eq('id', sesi.user.id).maybeSingle();
    if (error) {
      if (tabelBelumAda(error)) return tampilPesan('Sistem PPDB online belum diaktifkan oleh sekolah. Silakan coba lagi nanti atau hubungi panitia PPDB.', tombolKeluar());
      return tampilPesan('Data pendaftaran gagal dimuat: ' + pesanGalat(error), h('button', { class: 'btn btn-hijau', onclick: muatPendaftar }, 'Coba lagi'), tombolKeluar());
    }
    if (!data) {
      const meta = sesi.user.user_metadata || {};
      if (meta.jenis !== 'pendaftar') return tampilPesan('Akun ini adalah akun guru/staf, bukan akun calon santri. Silakan keluar, lalu buat akun calon santri dengan email lain.', tombolKeluar());
      const r = await sb.from('pendaftar').insert({ id: sesi.user.id, email: sesi.user.email, nama: meta.nama || '', no_wa: meta.no_wa || '' }).select().maybeSingle();
      if (r.error || !r.data) return tampilPesan('Data pendaftaran belum siap: ' + (r.error ? pesanGalat(r.error) : 'coba muat ulang halaman') + '.', tombolKeluar());
      data = r.data;
    }
    saya = data;
    tampilDasbor();
  }
  function tombolKeluar() {
    return h('p', null, h('button', { type: 'button', class: 'po-link', onclick: () => sb.auth.signOut() }, 'Keluar'));
  }
  async function simpan(isian, pesanBerhasil) {
    const { data, error } = await sb.from('pendaftar').update(isian).eq('id', saya.id).select().maybeSingle();
    if (error || !data) { toast('Gagal menyimpan: ' + (error ? pesanGalat(error) : 'coba muat ulang halaman'), true); return false; }
    saya = data; if (pesanBerhasil) toast(pesanBerhasil); terbuka = null; tampilDasbor(); return true;
  }

  /* ---------- Unggah berkas (foto diperkecil otomatis) ---------- */
  function kecilkan(file, maks = 1600) {
    return new Promise((res) => {
      if (!/^image\//.test(file.type) || file.type === 'image/gif') return res(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        const s = Math.min(1, maks / Math.max(img.width, img.height));
        if (s === 1 && file.size < 900 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return res(file);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => res(b ? new File([b], 'foto.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.85);
      };
      img.onerror = () => res(file);
      img.src = URL.createObjectURL(file);
    });
  }
  async function unggahBerkas(file, nama) {
    if (file.size > 30 * 1024 * 1024) throw new Error('exceeded the maximum allowed size');
    const siap = await kecilkan(file);
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(siap.type)) throw new Error('mime type not supported');
    if (siap.size > 5 * 1024 * 1024) throw new Error('exceeded the maximum allowed size');
    const ext = siap.type === 'application/pdf' ? 'pdf' : siap.type.split('/')[1].replace('jpeg', 'jpg');
    const jalur = `${saya.id}/${nama}-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(jalur, siap, { contentType: siap.type, upsert: false });
    if (error) throw error;
    return jalur;
  }
  function tombolLihat(jalur, teks) {
    if (!jalur) return null;
    return h('button', { type: 'button', class: 'po-link', onclick: async () => {
      const w = window.open('', '_blank');
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(jalur, 600);
      if (error || !data) { if (w) w.close(); return toast('Berkas tidak bisa dibuka: ' + (error ? pesanGalat(error) : ''), true); }
      if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
    } }, teks);
  }
  function kotakUnggah(label, nama, kolom, pesan) {
    const input = h('input', { type: 'file', accept: 'image/*,application/pdf', class: 'po-file' });
    const tombol = h('span', { class: 'btn btn-emas btn-kecil' }, '📤 ' + label);
    input.addEventListener('change', async () => {
      const f = input.files[0]; if (!f) return;
      tombol.textContent = 'Mengunggah…';
      try {
        const jalur = await unggahBerkas(f, nama);
        await simpan({ [kolom]: jalur }, pesan);
      } catch (e) { toast('Gagal mengunggah: ' + pesanGalat(e), true); tombol.textContent = '📤 ' + label; }
      input.value = '';
    });
    return h('label', { class: 'po-unggah' }, tombol, input, h('small', null, 'Foto (JPG/PNG) atau PDF, maksimal 5 MB.'));
  }

  /* ---------- Dasbor 10 langkah ---------- */
  const JUDUL = ['Buat Akun', 'Login', 'Pembayaran Registrasi', 'Pemilihan Sekolah', 'Pengisian Biodata',
    'Pengisian Berkas Wawancara', 'Join Group WA', 'Tes/Seleksi Offline Tahap Awal', 'Tes Tahap Akhir', 'Pengumuman Kelulusan'];

  function hitungLangkah() {
    const s = saya, L = [];
    const sudahBayar = s.status_bayar === 'menunggu' || s.status_bayar === 'diterima';
    const pilih = !!(s.jenjang && s.program);
    L.push({ st: 'selesai', ket: 'Selesai', isi: () => [h('p', null, 'Akun dibuat dengan email ', h('b', null, s.email || sesi.user.email), '.')] });
    L.push({ st: 'selesai', ket: 'Selesai', isi: () => [h('p', null, 'Anda sudah masuk ke sistem PPDB.')] });
    L.push({
      st: s.status_bayar === 'diterima' ? 'selesai' : s.status_bayar === 'menunggu' ? 'menunggu' : s.status_bayar === 'ditolak' ? 'gagal' : 'aktif',
      ket: { belum: 'Belum dibayar', menunggu: 'Menunggu pemeriksaan', diterima: 'Diterima', ditolak: 'Ditolak, unggah ulang' }[s.status_bayar] || '',
      isi: isiBayar });
    L.push({ st: !sudahBayar ? 'terkunci' : pilih ? 'selesai' : 'aktif', ket: pilih ? s.jenjang + ' · ' + s.program : 'Belum memilih', isi: isiPilih });
    L.push({ st: !pilih ? 'terkunci' : s.biodata_lengkap ? 'selesai' : 'aktif', ket: s.biodata_lengkap ? 'Lengkap' : 'Belum lengkap', isi: isiBiodata });
    L.push({ st: !s.biodata_lengkap ? 'terkunci' : s.wawancara_lengkap ? 'selesai' : 'aktif', ket: s.wawancara_lengkap ? 'Lengkap' : 'Belum lengkap', isi: isiWawancara });
    L.push({ st: !s.wawancara_lengkap ? 'terkunci' : s.gabung_grup ? 'selesai' : 'aktif', ket: s.gabung_grup ? 'Sudah bergabung' : 'Belum bergabung', isi: isiGrup });
    L.push({ st: !s.wawancara_lengkap ? 'terkunci' : s.tes_awal === 'lulus' ? 'selesai' : s.tes_awal === 'tidak_lulus' ? 'gagal' : 'menunggu',
      ket: { belum: 'Menunggu hasil', lulus: 'Lulus', tidak_lulus: 'Tidak lulus' }[s.tes_awal], isi: isiTesAwal });
    L.push({ st: s.tes_awal !== 'lulus' ? 'terkunci' : s.tes_akhir === 'lulus' ? 'selesai' : s.tes_akhir === 'tidak_lulus' ? 'gagal' : (s.surat_sehat ? 'menunggu' : 'aktif'),
      ket: s.tes_akhir === 'lulus' ? 'Lulus' : s.tes_akhir === 'tidak_lulus' ? 'Tidak lulus' : s.surat_sehat ? 'Menunggu hasil' : 'Unggah surat kesehatan', isi: isiTesAkhir });
    L.push({ st: s.kelulusan === 'lulus' ? 'selesai' : s.kelulusan === 'tidak_lulus' ? 'gagal' : s.kelulusan === 'cadangan' ? 'menunggu'
        : (s.tes_akhir !== 'belum' ? 'menunggu' : 'terkunci'),
      ket: { belum: 'Belum diumumkan', lulus: 'LULUS', tidak_lulus: 'Tidak lulus', cadangan: 'Cadangan' }[s.kelulusan], isi: isiPengumuman });
    // Jika kelulusan sudah diumumkan, langkah terakhir selalu bisa dibuka
    return L;
  }

  function tampilDasbor() {
    root.className = '';
    const L = hitungLangkah();
    const selesai = L.filter(x => x.st === 'selesai').length;
    const kini = L.findIndex(x => x.st === 'aktif' || x.st === 'gagal');
    const menunggu = L.map((x, i) => x.st === 'menunggu' ? i : -1).filter(i => i >= 0);
    const sekarang = kini >= 0 ? kini : (menunggu.length ? menunggu[menunggu.length - 1] : -1);
    if (terbuka === null) terbuka = sekarang >= 0 ? sekarang : 9;
    const daftar = h('ol', { class: 'po-langkah' }, L.map((x, i) => {
      const buka = terbuka === i && x.st !== 'terkunci';
      const kepala = h('button', { type: 'button', class: 'po-kepala', 'aria-expanded': String(buka), disabled: x.st === 'terkunci',
        onclick: () => { terbuka = terbuka === i ? -1 : i; tampilDasbor(); } },
        h('span', { class: 'po-no' }, x.st === 'selesai' ? '✓' : (i < 9 ? '0' : '') + (i + 1)),
        h('span', { class: 'po-judul' }, JUDUL[i]),
        h('span', { class: 'po-status st-' + x.st }, x.st === 'terkunci' ? '🔒 Terkunci' : x.ket));
      return h('li', { class: 'po-l st-' + x.st + (buka ? ' buka' : '') + (i === sekarang ? ' kini' : '') }, kepala,
        buka ? h('div', { class: 'po-badan' }, x.isi()) : null);
    }));
    const pesanPanitia = saya.pesan_panitia ? h('div', { class: 'po-pesan info po-panitia' }, h('b', null, '📣 Pesan dari panitia: '), saya.pesan_panitia) : null;
    root.replaceChildren(
      h('div', { class: 'po-atas' },
        h('div', null, h('small', null, 'Assalamu\'alaikum,'), h('h2', null, saya.nama || 'Calon Santri'),
          h('p', null, 'No. pendaftaran: ', h('b', null, saya.nomor || '-'), ' · ', saya.email || '')),
        h('div', { class: 'po-kemajuan' }, h('div', { class: 'po-bar' }, h('span', { style: 'width:' + (selesai * 10) + '%' })),
          h('small', null, selesai + ' dari 10 langkah selesai')),
        h('button', { type: 'button', class: 'po-link po-keluar', onclick: () => sb.auth.signOut() }, 'Keluar')),
      ...[pesanPanitia, daftar, bantuan()].filter(Boolean));
  }

  /* ---------- Isi setiap langkah ---------- */
  function isiBayar() {
    const s = saya;
    let biaya = ON.biaya_registrasi;
    if (!biaya) {
      const b = (P.biaya || []).find(x => /daftar/i.test(x.komponen || ''));
      if (b) biaya = 'SMP ' + b.smp + ' · SMA ' + b.sma;
    }
    const keadaan = {
      belum: null,
      menunggu: h('div', { class: 'po-pesan info' }, '⏳ Bukti pembayaran sudah diterima sistem dan sedang diperiksa panitia. Anda bisa lanjut ke langkah berikutnya.'),
      diterima: h('div', { class: 'po-pesan sukses' }, '✅ Pembayaran registrasi sudah diterima panitia.'),
      ditolak: h('div', { class: 'po-pesan galat' }, '❌ Bukti pembayaran ditolak panitia. Periksa pesan panitia di atas, lalu unggah ulang bukti yang benar.'),
    }[s.status_bayar];
    return [
      ...paragraf(ON.info_bayar || 'Transfer biaya registrasi ke rekening berikut, lalu unggah bukti transfer.'),
      h('div', { class: 'po-rincian' },
        biaya ? h('div', null, h('small', null, 'Biaya registrasi'), h('b', null, biaya)) : null,
        P.rekening ? h('div', null, h('small', null, 'Rekening pembayaran'), h('b', null, P.rekening)) : null),
      h('p', { class: 'po-kecil' }, h('a', { href: D.ppdb_url + '#biaya', target: '_blank' }, 'Lihat rincian biaya lengkap')),
      keadaan,
      s.bukti_bayar ? h('p', null, tombolLihat(s.bukti_bayar, '📄 Lihat bukti yang sudah diunggah')) : null,
      s.status_bayar === 'diterima' ? null : kotakUnggah(s.bukti_bayar ? 'Unggah ulang bukti pembayaran' : 'Unggah bukti pembayaran', 'bukti-bayar', 'bukti_bayar', 'Bukti pembayaran terkirim. Silakan lanjut memilih sekolah.'),
    ];
  }

  function isiPilih() {
    const s = saya, kunci = s.kelulusan !== 'belum';
    let jenjang = s.jenjang || '', program = s.program || '';
    const progBox = h('div', { class: 'po-pilihan' });
    const daftarProgram = (D.program || []).filter(p => p && p.nama);
    const gambarProgram = () => {
      const cocok = daftarProgram.filter(p => !jenjang || !Array.isArray(p.jenjang) || !p.jenjang.length || p.jenjang.includes(jenjang));
      progBox.replaceChildren(...(cocok.length ? cocok : [{ nama: 'Reguler' }]).map(p => {
        const slug = String(p.nama).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const hp = D.halaman_program || {}, nm = String(p.nama).toLowerCase();
        const urlProgram = /takh/.test(nm) && hp.takhassus ? hp.takhassus : /tahf/.test(nm) && hp.tahfizh ? hp.tahfizh : D.profil_url + '#' + slug;
        return h('label', { class: 'po-opsi' + (program === p.nama ? ' dipilih' : '') },
          h('input', { type: 'radio', name: 'program', value: p.nama, checked: program === p.nama, disabled: kunci,
            onchange: () => { program = p.nama; gambarProgram(); } }),
          h('span', null, h('b', null, (p.ikon ? p.ikon + ' ' : '') + (p.nama_lengkap || p.nama)),
            p.kampus ? h('small', { class: 'po-kampus' }, '📍 ' + p.kampus + (p.alamat ? ' · ' + p.alamat : '')) : null,
            p.ringkasan ? h('small', null, p.ringkasan) : null,
            p.nama !== 'Reguler' ? h('a', { href: urlProgram, target: '_blank', onclick: (e) => e.stopPropagation() }, 'Baca informasi program →') : null));
      }));
    };
    const opsiJenjang = [['SMP', 'SMP Islam Terpadu', 'Untuk lulusan SD/MI sederajat'], ['SMA', 'SMA Islam Terpadu', 'Untuk lulusan SMP/MTs sederajat']].map(([k, n, ket]) =>
      h('label', { class: 'po-opsi' + (jenjang === k ? ' dipilih' : '') },
        h('input', { type: 'radio', name: 'jenjang', value: k, checked: jenjang === k, disabled: kunci,
          onchange: () => { jenjang = k; [...jBox.children].forEach(c => c.classList.toggle('dipilih', c.querySelector('input').checked)); gambarProgram(); } }),
        h('span', null, h('b', null, n), h('small', null, ket))));
    const jBox = h('div', { class: 'po-pilihan dua' }, opsiJenjang);
    gambarProgram();
    const btn = h('button', { type: 'button', class: 'btn btn-hijau', disabled: kunci, onclick: async () => {
      if (!jenjang || !program) return toast('Pilih jenjang dan program terlebih dahulu.', true);
      sibuk(btn, true, 'Menyimpan…');
      if (!(await simpan({ jenjang, program }, 'Pilihan sekolah disimpan.'))) sibuk(btn, false, 'Simpan pilihan');
    } }, 'Simpan pilihan');
    return [h('p', null, 'Sebelum memilih, mohon baca informasi setiap program terlebih dahulu.'),
      h('h4', null, '1. Jenjang'), jBox, h('h4', null, '2. Program'), progBox, kunci ? null : btn];
  }

  function isiBiodata() {
    const s = saya, kunci = s.kelulusan !== 'belum';
    const bio = Object.assign({}, s.biodata || {});
    if (!bio.nama_lengkap && s.nama) bio.nama_lengkap = s.nama;
    if (!bio.hp_ibu && !bio.hp_ayah && s.no_wa) bio.hp_ibu = s.no_wa;
    const masukan = {};
    const form = h('form', { class: 'po-form', novalidate: true, onsubmit: (e) => e.preventDefault() },
      (window.PPDB_BIODATA || []).map(g => h('fieldset', null, h('legend', null, g.judul),
        h('div', { class: 'po-kisi' }, g.isian.map(([k, label, wajib, jenis, contoh]) => {
          const at = { value: bio[k] || '', disabled: kunci, placeholder: contoh || '' };
          let el;
          if (jenis === 'textarea') el = h('textarea', Object.assign({ rows: 3 }, at));
          else el = h('input', Object.assign({ type: jenis === 'angka' ? 'text' : (jenis || 'text'), inputmode: jenis === 'angka' || jenis === 'number' ? 'numeric' : null, maxlength: 300 }, at));
          masukan[k] = { el, wajib, label };
          return h('div', { class: jenis === 'textarea' ? 'lebar' : null }, h('label', null, label, wajib ? h('span', { class: 'wajib' }, ' *') : null), el);
        })))));
    const btn = h('button', { type: 'button', class: 'btn btn-hijau', disabled: kunci, onclick: async () => {
      const data = {}, kurang = [];
      for (const [k, m] of Object.entries(masukan)) {
        data[k] = m.el.value.trim();
        m.el.classList.toggle('kosong', m.wajib && !data[k]);
        if (m.wajib && !data[k]) kurang.push(m.label);
      }
      sibuk(btn, true, 'Menyimpan…');
      const ok = await simpan({ biodata: data, biodata_lengkap: !kurang.length, nama: data.nama_lengkap || s.nama },
        kurang.length ? null : 'Biodata lengkap tersimpan. Lanjut ke formulir wawancara.');
      if (!ok) return sibuk(btn, false, 'Simpan biodata');
      if (kurang.length) toast('Tersimpan, tetapi isian wajib berikut masih kosong: ' + kurang.join(', '), true);
    } }, 'Simpan biodata');
    return [h('p', null, 'Isi biodata dengan baik dan benar. Tanda ', h('span', { class: 'wajib' }, '*'), ' wajib diisi.'), form, kunci ? null : btn];
  }

  function isiWawancara() {
    const s = saya, kunci = s.kelulusan !== 'belum';
    const daftar = (ON.pertanyaan_wawancara || []).filter(q => q && q.pertanyaan);
    if (!daftar.length) return [h('p', null, 'Formulir wawancara belum disiapkan panitia. Silakan cek kembali nanti.')];
    const jawab = s.wawancara || {};
    const kelompok = {};
    daftar.forEach(q => { (kelompok[q.bagian || 'Pertanyaan'] = kelompok[q.bagian || 'Pertanyaan'] || []).push(q.pertanyaan); });
    const isian = [];
    const form = h('form', { class: 'po-form', onsubmit: (e) => e.preventDefault() }, Object.entries(kelompok).map(([bag, qs]) =>
      h('fieldset', null, h('legend', null, 'Untuk ' + bag.toLowerCase()), qs.map((q, i) => {
        const el = h('textarea', { rows: 2, value: jawab[q] || '', disabled: kunci, maxlength: 2000 });
        isian.push([q, el]);
        return h('div', null, h('label', null, (i + 1) + '. ' + q), el);
      }))));
    const btn = h('button', { type: 'button', class: 'btn btn-hijau', disabled: kunci, onclick: async () => {
      const data = {}; let kosong = 0;
      isian.forEach(([q, el]) => { data[q] = el.value.trim(); el.classList.toggle('kosong', !data[q]); if (!data[q]) kosong++; });
      sibuk(btn, true, 'Menyimpan…');
      const ok = await simpan({ wawancara: data, wawancara_lengkap: kosong === 0 }, kosong ? null : 'Formulir wawancara tersimpan. Silakan join grup WhatsApp.');
      if (!ok) return sibuk(btn, false, 'Simpan jawaban');
      if (kosong) toast('Tersimpan, tetapi masih ada ' + kosong + ' pertanyaan yang belum dijawab.', true);
    } }, 'Simpan jawaban');
    return [h('p', null, 'Jawab pertanyaan berikut tentang calon santri dan orang tua/wali. Semua pertanyaan wajib dijawab.'), form, kunci ? null : btn];
  }

  function isiGrup() {
    const box = h('div', { class: 'po-grup' }, h('p', { class: 'po-kecil' }, 'Memuat link grup…'));
    sb.from('ppdb_rahasia').select('grup_wa').eq('id', 1).maybeSingle().then(({ data, error }) => {
      const grup = ((data && data.grup_wa) || []).filter(g => g && /^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//i.test(g.link || ''));
      if (error || !grup.length) return box.replaceChildren(h('div', { class: 'po-pesan peringatan' }, 'Link grup WhatsApp belum tersedia. Panitia akan menghubungi Anda, atau ', kontakPanitia() || 'hubungi panitia', '.'));
      box.replaceChildren(...grup.map(g => h('a', { class: 'btn btn-wa', href: g.link, target: '_blank', rel: 'noopener' }, '💬 Gabung ' + (g.nama || 'grup WhatsApp'))));
    });
    const btn = h('button', { type: 'button', class: 'btn btn-hijau', onclick: async () => { sibuk(btn, true, 'Menyimpan…'); if (!(await simpan({ gabung_grup: true }, 'Terima kasih. Pantau informasi tes di grup.'))) sibuk(btn, false, 'Saya sudah bergabung'); } }, 'Saya sudah bergabung');
    return [h('p', null, 'Silakan bergabung ke grup WhatsApp calon santri untuk mendapatkan informasi seputar pondok dan jadwal tes.'), box,
      saya.gabung_grup ? h('div', { class: 'po-pesan sukses' }, '✅ Anda sudah menandai bergabung ke grup.') : btn];
  }

  function isiTesAwal() {
    const st = saya.tes_awal;
    return [...paragraf(ON.info_tes_awal),
      st === 'lulus' ? h('div', { class: 'po-pesan sukses' }, '✅ Alhamdulillah, ananda LULUS Tes Tahap Awal. Silakan lanjut ke Tes Tahap Akhir.')
        : st === 'tidak_lulus' ? h('div', { class: 'po-pesan galat' }, 'Mohon maaf, ananda belum lulus Tes Tahap Awal. Semoga Allah memberikan yang terbaik.')
        : h('div', { class: 'po-pesan info' }, '⏳ Hasil Tes Tahap Awal akan ditampilkan di sini setelah dinilai panitia.')];
  }

  function isiTesAkhir() {
    const s = saya, st = s.tes_akhir;
    return [...paragraf(ON.info_tes_akhir),
      s.surat_sehat ? h('p', null, tombolLihat(s.surat_sehat, '📄 Lihat surat kesehatan yang sudah diunggah')) : null,
      st === 'belum' && s.kelulusan === 'belum' ? kotakUnggah(s.surat_sehat ? 'Unggah ulang surat kesehatan' : 'Unggah surat hasil kesehatan', 'surat-sehat', 'surat_sehat', 'Surat kesehatan terkirim.') : null,
      st === 'lulus' ? h('div', { class: 'po-pesan sukses' }, '✅ Ananda lulus Tes Tahap Akhir. Tunggu pengumuman kelulusan.')
        : st === 'tidak_lulus' ? h('div', { class: 'po-pesan galat' }, 'Mohon maaf, ananda belum lulus Tes Tahap Akhir.')
        : h('div', { class: 'po-pesan info' }, '⏳ Hasil Tes Tahap Akhir akan ditampilkan di sini.')];
  }

  function isiPengumuman() {
    const k = saya.kelulusan;
    if (k === 'lulus') return [h('div', { class: 'po-lulus' }, h('div', { class: 'po-ikon' }, '🎉'), h('h3', null, 'Selamat, ananda dinyatakan LULUS!'), ...paragraf(ON.info_lulus))];
    if (k === 'cadangan') return [h('div', { class: 'po-pesan peringatan' }, 'Ananda masuk daftar CADANGAN. Panitia akan menghubungi jika ada kursi yang tersedia.')];
    if (k === 'tidak_lulus') return [h('div', { class: 'po-pesan galat' }, 'Mohon maaf, ananda belum dinyatakan lulus pada PPDB tahun ini. Terima kasih atas kepercayaan Bapak/Ibu. Semoga Allah memberikan yang terbaik.')];
    return [h('p', null, 'Pengumuman kelulusan akan tampil di sini. Silakan login kembali secara berkala.')];
  }

  mulai().catch(e => tampilPesan('Terjadi kesalahan: ' + pesanGalat(e)));
})();
