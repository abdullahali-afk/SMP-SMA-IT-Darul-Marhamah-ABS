/* Panel Admin Darul Marhamah ABS — Supabase (login, peran & akses, isi website) */
(function () {
'use strict';

const app = document.getElementById('app');
const SITUS = new URL('../', location.href).href;
const KATEGORI_BERITA = ['Prestasi', 'Kegiatan', 'Akademik', 'PPDB', 'Pengumuman'];
let sb = null, cfg = {}, sesi = null, profil = null, peranSaya = null, semuaPeran = [];

/* ---------- Bantuan DOM ---------- */
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
function toast(teks, galat) {
  const t = document.getElementById('toast');
  t.textContent = teks; t.className = 'tampil' + (galat ? ' galat' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = '', galat ? 6000 : 3000);
}
function pesanGalat(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  const peta = {
    'Invalid login credentials': 'Email atau password salah.',
    'Email not confirmed': 'Email belum dikonfirmasi. Buka email Anda dan klik link konfirmasi.',
    'User already registered': 'Email ini sudah terdaftar. Silakan masuk.',
    'Password should be at least 6 characters': 'Password minimal 6 karakter.',
    'Error sending confirmation email': 'Supabase gagal mengirim email konfirmasi. Matikan "Confirm email" di Supabase (Authentication → Sign In / Providers → Email).',
    'Error sending recovery email': 'Email reset tidak bisa dikirim. Minta admin membuatkan password baru lewat menu Pengguna.',
    'email rate limit exceeded': 'Terlalu banyak email dikirim. Coba lagi sekitar 1 jam lagi, atau minta admin membuatkan password baru.',
    'Signups not allowed for this instance': 'Pendaftaran akun sedang ditutup oleh admin.',
  };
  if (peta[m]) return peta[m];
  if (/jwt|exp claim|token.*expired|invalid token/i.test(m)) return 'Sesi login sudah habis. Muat ulang halaman (refresh) lalu masuk lagi.';
  if (/row-level security|violates.*policy|unauthorized|403/i.test(m)) return 'Akun Anda belum punya izin untuk ini. Minta admin memeriksa akses akun Anda di menu Pengguna.';
  if (/exceeded the maximum allowed size|payload too large|413/i.test(m)) return 'File terlalu besar untuk diunggah.';
  if (/mime type|not supported/i.test(m)) return 'Jenis file ini tidak didukung. Gunakan foto JPG atau PNG.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) return 'Koneksi internet terputus. Periksa sinyal lalu coba lagi.';
  return m;
}
function slugify(t) {
  return String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'berita';
}
function salin(o) { return JSON.parse(JSON.stringify(o)); }
function sibuk(btn, ya, teks) { btn.disabled = ya; if (teks) btn.textContent = teks; }

/* ---------- Hak akses ---------- */
const adalahAdmin = () => !!(peranSaya && peranSaya.akses.includes('*'));
const boleh = (bagian) => adalahAdmin() || !!(peranSaya && peranSaya.akses.includes(bagian));
const semuaBagian = () => [window.BAGIAN_BERITA, ...window.SKEMA, window.BAGIAN_PENDAFTAR].filter(Boolean);
const hrefBagian = (b) => b.kunci === 'berita' ? '#/berita' : b.kunci === 'pendaftar' ? '#/pendaftar' : '#/konten/' + b.kunci;

/* ---------- Mulai ---------- */
async function mulai() {
  try { cfg = await (await fetch('konfigurasi.json', { cache: 'no-store' })).json(); } catch (e) { cfg = {}; }
  if (!cfg.url || !cfg.anonKey || !window.supabase) {
    app.replaceChildren(layarMasuk(h('div', { class: 'pesan peringatan' },
      'Panel admin belum tersambung ke database. Isi Project URL dan anon key Supabase di file admin/konfigurasi.json.')));
    return;
  }
  sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === 'PASSWORD_RECOVERY') { sesi = s; tampilGantiPassword(true); return; }
    if (ev === 'SIGNED_OUT') { sesi = null; profil = null; peranSaya = null; tampilMasuk(); }
  });
  const { data } = await sb.auth.getSession();
  sesi = data.session;
  if (location.hash.includes('type=recovery')) return; // ditangani PASSWORD_RECOVERY
  if (sesi) await muatProfil(); else tampilMasuk();
}

async function muatProfil() {
  const uid = sesi.user.id;
  const { data: p, error } = await sb.from('profil').select('*').eq('id', uid).maybeSingle();
  if (error) { app.replaceChildren(layarMasuk(h('div', { class: 'pesan galat' }, 'Gagal memuat akun: ' + pesanGalat(error)), tombolKeluar())); return; }
  if (!p && sesi.user.user_metadata && sesi.user.user_metadata.jenis === 'pendaftar') {
    app.replaceChildren(layarMasuk(h('div', { class: 'pesan info' }, 'Ini akun calon santri. Silakan masuk melalui halaman ',
      h('a', { href: SITUS + 'pendaftaran/' }, 'PPDB Online'), '.'), tombolKeluar())); return;
  }
  if (!p) { app.replaceChildren(layarMasuk(h('div', { class: 'pesan galat' }, 'Akun ini tidak lagi memiliki akses. Hubungi admin sekolah.'), tombolKeluar())); return; }
  profil = p;
  const { data: rs } = await sb.from('peran').select('*').order('urutan');
  semuaPeran = rs || [];
  peranSaya = semuaPeran.find(r => r.kode === p.peran) || { kode: p.peran, nama: p.peran, akses: [] };
  if (!p.aktif) { app.replaceChildren(layarMasuk(h('div', { class: 'pesan galat' }, 'Akun Anda sedang dinonaktifkan oleh admin.'), tombolKeluar())); return; }
  window.removeEventListener('hashchange', rute);
  window.addEventListener('hashchange', rute);
  rute();
}

function tombolKeluar() {
  return h('p', { style: 'text-align:center;margin-top:14px' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); sb.auth.signOut(); } }, 'Keluar'));
}

/* ---------- Layar masuk / daftar / lupa ---------- */
function layarMasuk(...isi) {
  return h('div', { class: 'masuk' }, h('div', { class: 'kotak-masuk' },
    h('img', { src: '../assets/logo.png', alt: 'Logo' }),
    h('h1', null, 'Panel Admin'),
    h('p', { class: 'kecil' }, 'Darul Marhamah Al-Qur\'an Boarding School'),
    ...isi));
}

function tampilMasuk(mode = 'masuk', info) {
  const err = h('div');
  const tampilErr = (t, jenis = 'galat') => err.replaceChildren(h('div', { class: 'pesan ' + jenis }, t));
  let form, tautan;
  if (mode === 'masuk') {
    const email = h('input', { type: 'email', required: true, autocomplete: 'username', placeholder: 'nama@email.com' });
    const pw = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
    const btn = h('button', { class: 'btn', type: 'submit', style: 'justify-content:center' }, 'Masuk');
    form = h('form', { onsubmit: async (e) => {
      e.preventDefault(); sibuk(btn, true, 'Memproses…');
      const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
      sibuk(btn, false, 'Masuk');
      if (error) return tampilErr(pesanGalat(error));
      sesi = data.session; location.hash = '#/'; muatProfil();
    } }, h('div', null, h('label', null, 'Email'), email), h('div', null, h('label', null, 'Password'), pw), btn);
    tautan = h('div', { class: 'tautan-bawah' },
      h('a', { onclick: () => tampilMasuk('daftar') }, 'Belum punya akun? Daftar'),
      h('a', { onclick: () => tampilMasuk('lupa') }, 'Lupa password?'));
  } else if (mode === 'daftar') {
    const nama = h('input', { type: 'text', required: true, placeholder: 'Nama lengkap' });
    const email = h('input', { type: 'email', required: true, autocomplete: 'username' });
    const pw = h('input', { type: 'password', required: true, minlength: 6, autocomplete: 'new-password' });
    const btn = h('button', { class: 'btn', type: 'submit', style: 'justify-content:center' }, 'Daftar');
    form = h('form', { onsubmit: async (e) => {
      e.preventDefault(); sibuk(btn, true, 'Memproses…');
      const { data, error } = await sb.auth.signUp({ email: email.value.trim(), password: pw.value,
        options: { data: { nama: nama.value.trim() }, emailRedirectTo: location.href.split('#')[0] } });
      sibuk(btn, false, 'Daftar');
      if (error) return tampilErr(pesanGalat(error));
      if (data.session) { sesi = data.session; return muatProfil(); }
      tampilMasuk('masuk', 'Pendaftaran berhasil. Cek email Anda untuk konfirmasi, lalu masuk. Setelah itu admin akan mengatur hak akses Anda.');
    } }, h('div', null, h('label', null, 'Nama lengkap'), nama), h('div', null, h('label', null, 'Email'), email),
      h('div', null, h('label', null, 'Password (min. 6 karakter)'), pw), btn);
    tautan = h('div', { class: 'tautan-bawah' }, h('a', { onclick: () => tampilMasuk('masuk') }, '← Kembali ke halaman masuk'));
  } else {
    const email = h('input', { type: 'email', required: true });
    const btn = h('button', { class: 'btn', type: 'submit', style: 'justify-content:center' }, 'Kirim link reset');
    form = h('form', { onsubmit: async (e) => {
      e.preventDefault(); sibuk(btn, true, 'Mengirim…');
      const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.href.split('#')[0] });
      sibuk(btn, false, 'Kirim link reset');
      if (error) return tampilErr(pesanGalat(error));
      tampilErr('Link untuk membuat password baru sudah dikirim ke email Anda.', 'info');
    } }, h('div', null, h('label', null, 'Email akun Anda'), email), btn);
    tautan = h('div', { class: 'tautan-bawah' }, h('a', { onclick: () => tampilMasuk('masuk') }, '← Kembali ke halaman masuk'));
  }
  app.replaceChildren(layarMasuk(info ? h('div', { class: 'pesan info', style: 'margin-bottom:12px' }, info) : null, err, form, tautan));
}

function tampilGantiPassword(dariEmail) {
  const pw = h('input', { type: 'password', required: true, minlength: 6, autocomplete: 'new-password' });
  const pw2 = h('input', { type: 'password', required: true, minlength: 6, autocomplete: 'new-password' });
  const err = h('div');
  const btn = h('button', { class: 'btn', type: 'submit' }, 'Simpan password baru');
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    if (pw.value !== pw2.value) return err.replaceChildren(h('div', { class: 'pesan galat' }, 'Kedua password tidak sama.'));
    sibuk(btn, true, 'Menyimpan…');
    const { error } = await sb.auth.updateUser({ password: pw.value });
    sibuk(btn, false, 'Simpan password baru');
    if (error) return err.replaceChildren(h('div', { class: 'pesan galat' }, pesanGalat(error)));
    toast('Password berhasil diganti.');
    if (dariEmail) { history.replaceState(null, '', location.pathname + '#/'); const { data } = await sb.auth.getSession(); sesi = data.session; muatProfil(); }
    else { pw.value = pw2.value = ''; }
  } }, h('div', null, h('label', null, 'Password baru'), pw), h('div', null, h('label', null, 'Ulangi password baru'), pw2), err, btn);
  if (dariEmail) app.replaceChildren(layarMasuk(h('p', { style: 'margin-bottom:10px' }, 'Buat password baru untuk akun Anda.'), form));
  return form;
}

/* ---------- Kerangka setelah masuk ---------- */
function kerangka(judul, sub, ...isi) {
  const rt = location.hash || '#/';
  const cocok = (href) => rt === href || (href !== '#/' && rt.startsWith(href + '/'));
  const tautan = (href, ik, teks) => h('a', { href, class: cocok(href) ? 'aktif' : null }, h('span', null, ik), teks);
  const samping = h('aside', { class: 'samping' },
    h('div', { class: 'merek' }, h('img', { src: '../assets/logo.png', alt: '' }), h('div', null, h('b', null, 'Darul Marhamah'), h('small', null, 'Panel Admin'))),
    tautan('#/', '🏠', 'Dasbor'));
  if (profil.peran !== 'menunggu') {
    const isiWeb = semuaBagian().filter(b => boleh(b.kunci));
    if (isiWeb.length) { samping.append(h('h4', null, 'Isi Website')); isiWeb.forEach(b => samping.append(tautan(hrefBagian(b), b.ikon, b.label))); }
  }
  if (adalahAdmin()) samping.append(h('h4', null, 'Administrasi'), tautan('#/pengguna', '👥', 'Pengguna'), tautan('#/peran', '🔐', 'Peran & Hak Akses'));
  samping.append(h('h4', null, 'Akun'), tautan('#/akun', '⚙️', 'Pengaturan Akun'),
    h('a', { href: SITUS, target: '_blank' }, h('span', null, '🌐'), 'Lihat Website'),
    h('a', { href: '#', onclick: (e) => { e.preventDefault(); sb.auth.signOut(); } }, h('span', null, '🚪'), 'Keluar'));
  const burger = h('button', { class: 'burger', 'aria-label': 'Menu', onclick: () => samping.classList.toggle('buka') }, '☰');
  samping.addEventListener('click', (e) => { if (e.target.closest('a')) samping.classList.remove('buka'); });
  const atas = h('div', { class: 'atas' }, burger, h('div', { class: 'siapa' }, 'Masuk sebagai ', h('b', null, profil.nama || profil.email), h('span', { class: 'lencana' }, peranSaya.nama)));
  app.replaceChildren(h('div', { class: 'kerangka' }, samping, h('div', { class: 'utama' }, atas,
    h('div', { class: 'isi' }, h('h1', null, judul), sub ? h('p', { class: 'sub' }, sub) : null, ...isi))));
}

/* ---------- Perubahan yang belum disimpan ---------- */
let kotor = false, hashTerakhir = location.hash;
function tandaiKotor() { kotor = true; if (tandaiKotor.cb) tandaiKotor.cb(); }
function bersih() { kotor = false; tandaiKotor.cb = null; }
window.addEventListener('beforeunload', (e) => { if (kotor) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- Rute ---------- */
function rute() {
  if (!profil) return;
  if (kotor && location.hash !== hashTerakhir) {
    if (!confirm('Ada perubahan (misalnya foto baru) yang BELUM disimpan. Tinggalkan halaman ini tanpa menyimpan?')) {
      history.replaceState(null, '', hashTerakhir || '#/'); return;
    }
  }
  bersih(); hashTerakhir = location.hash;
  const r = (location.hash || '#/').slice(1).split('/').filter(Boolean);
  window.scrollTo(0, 0);
  if (r[0] === 'akun') return halamanAkun();
  if (profil.peran === 'menunggu' || !profil.aktif) return halamanDasbor();
  if (r[0] === 'konten' && r[1]) return boleh(r[1]) ? halamanKonten(r[1]) : tolak();
  if (r[0] === 'pendaftar') return !boleh('pendaftar') ? tolak() : r[1] === 'nilai' ? halamanRekapNilai() : r[1] ? halamanPendaftarDetail(r[1], r[2] === 'nilai') : halamanPendaftar();
  if (r[0] === 'berita') return !boleh('berita') ? tolak() : (r[1] ? halamanBeritaForm(r[1]) : halamanBerita());
  if (r[0] === 'pengguna') return adalahAdmin() ? halamanPengguna() : tolak();
  if (r[0] === 'peran') return adalahAdmin() ? halamanPeran() : tolak();
  return halamanDasbor();
}
function tolak() { kerangka('Tidak ada akses', null, h('div', { class: 'pesan galat' }, 'Peran Anda tidak memiliki akses ke bagian ini. Hubungi admin.')); }

/* ---------- Dasbor ---------- */
function halamanDasbor() {
  if (profil.peran === 'menunggu') {
    return kerangka('Assalamu\'alaikum, ' + (profil.nama || 'Bapak/Ibu'), null,
      h('div', { class: 'pesan peringatan' }, 'Akun Anda sudah terdaftar dan sedang menunggu persetujuan admin. Setelah admin memberi peran (misalnya Guru atau Pegawai), menu pengelolaan akan muncul di sini.'));
  }
  const ubin = semuaBagian().filter(b => boleh(b.kunci)).map(b =>
    h('a', { class: 'ubin', href: hrefBagian(b) }, h('span', { class: 'ik' }, b.ikon), h('div', null, h('b', null, b.label), h('small', null, 'Kelola')) ));
  if (adalahAdmin()) ubin.push(
    h('a', { class: 'ubin', href: '#/pengguna' }, h('span', { class: 'ik' }, '👥'), h('div', null, h('b', null, 'Pengguna'), h('small', null, 'Akun & peran'))),
    h('a', { class: 'ubin', href: '#/peran' }, h('span', { class: 'ik' }, '🔐'), h('div', null, h('b', null, 'Peran & Hak Akses'), h('small', null, 'Buka/tutup akses'))));
  kerangka('Assalamu\'alaikum, ' + (profil.nama || ''), 'Pilih bagian yang ingin Anda kelola.',
    h('div', { class: 'pesan info', style: 'margin-bottom:18px' }, 'Perubahan yang disimpan tampil di website dalam ±3 menit. Jika belum terlihat, muat ulang (refresh) halaman website.'),
    h('div', { class: 'kisi' }, ubin));
}

/* ---------- Editor isi (berdasarkan skema) ---------- */
async function halamanKonten(kunci) {
  const bagian = window.SKEMA.find(s => s.kunci === kunci);
  if (!bagian) return tolak();
  kerangka(bagian.ikon + ' ' + bagian.label, 'Memuat…');
  const awal0 = location.hash;
  const { data: baris, error } = await sb.from('konten').select('data, diubah').eq('kunci', kunci).maybeSingle();
  if (location.hash !== awal0) return;
  if (error) return kerangka(bagian.label, null, h('div', { class: 'pesan galat' }, pesanGalat(error)));
  let ada = !!baris, data = baris ? salin(baris.data) : null, info = null;
  if (data) {
    // Isian yang ditambahkan belakangan (belum ada di database) diisi dari isi website saat ini
    const kosong = bagian.fields.filter(f => data[f.name] === undefined);
    // Isian baru di dalam item daftar (mis. lokasi kampus tiap program): dicocokkan lewat nama/judul item
    const kurangItem = bagian.fields.filter(f => f.list && f.type === 'object' && Array.isArray(data[f.name]) &&
      data[f.name].some(it => it && typeof it === 'object' && (f.fields || []).some(x => it[x.name] === undefined)));
    if (kosong.length || kurangItem.length) {
      try {
        const awal = await (await fetch('data-awal.json', { cache: 'no-store' })).json();
        const a = awal && awal[kunci];
        const terisi = kosong.filter(f => a && a[f.name] !== undefined);
        terisi.forEach(f => { data[f.name] = salin(a[f.name]); });
        const labelBaru = terisi.map(f => f.label);
        kurangItem.forEach(f => {
          const asal = a && Array.isArray(a[f.name]) ? a[f.name] : [];
          data[f.name].forEach(it => {
            const nm = it && (it.nama || it.judul); if (!nm) return;
            const pas = asal.find(x => x && (x.nama || x.judul) === nm); if (!pas) return;
            (f.fields || []).forEach(x => {
              if (it[x.name] === undefined && pas[x.name] !== undefined) { it[x.name] = salin(pas[x.name]); if (!labelBaru.includes(x.label)) labelBaru.push(x.label); }
            });
          });
        });
        if (labelBaru.length) info = h('div', { class: 'pesan info', style: 'margin-bottom:14px' },
          'Isian baru "' + labelBaru.join('", "') + '" sudah diisi sesuai yang tampil di website. Klik Simpan agar tersimpan di panel.');
      } catch (e) { /* abaikan */ }
      if (location.hash !== awal0) return;
    }
  }
  if (!data) {
    // Belum pernah disimpan dari panel: mulai dari isi yang sekarang tampil di website
    try { const awal = await (await fetch('data-awal.json', { cache: 'no-store' })).json(); data = awal && awal[kunci] ? salin(awal[kunci]) : {}; } catch (e) { data = {}; }
    if (location.hash !== awal0) return;
    info = h('div', { class: 'pesan info', style: 'margin-bottom:14px' }, 'Bagian ini belum pernah disimpan dari panel. Isian di bawah diambil dari website saat ini; klik Simpan agar mulai dikelola dari panel.');
  }
  const form = h('div', { class: 'panel' }, ...bagian.fields.map(f => medan(f, data, kunci)));
  const btn = h('button', { class: 'btn btn-emas' }, '💾 Simpan perubahan');
  const ket = h('small', { style: 'color:var(--abu)' }, baris ? 'Terakhir diubah: ' + new Date(baris.diubah).toLocaleString('id-ID') : '');
  form.addEventListener('input', tandaiKotor);
  form.addEventListener('change', (e) => { if (e.target.type !== 'file') tandaiKotor(); });
  tandaiKotor.cb = () => { ket.textContent = '⚠️ Ada perubahan yang belum disimpan. Klik Simpan.'; ket.style.color = '#b45309'; };
  btn.addEventListener('click', async () => {
    sibuk(btn, true, 'Menyimpan…');
    try { await pastikanSesi(); } catch (e) { sibuk(btn, false, '💾 Simpan perubahan'); return toast('Gagal menyimpan: ' + pesanGalat(e), true); }
    const q = ada
      ? sb.from('konten').update({ data, diubah: new Date().toISOString() }).eq('kunci', kunci).select()
      : sb.from('konten').insert({ kunci, data }).select();
    const { data: hasil, error } = await q;
    sibuk(btn, false, '💾 Simpan perubahan');
    if (error || !hasil || !hasil.length) return toast('Gagal menyimpan: ' + (error ? pesanGalat(error) : 'tidak ada akses'), true);
    ada = true; kotor = false; if (info) info.remove();
    ket.style.color = 'var(--abu)';
    ket.textContent = 'Tersimpan ' + new Date().toLocaleTimeString('id-ID') + '. Tampil di website dalam ±3 menit (muat ulang halaman website).';
    toast('Perubahan tersimpan.');
  });
  kerangka(bagian.ikon + ' ' + bagian.label, 'Ubah isian lalu klik Simpan.', info, form, h('div', { class: 'aksi-simpan' }, btn, ket));
}

function nilaiAwal(f) {
  if (f.default !== undefined && !f.list) return salin(f.default);
  if (f.list) return [];
  if (f.type === 'object') { const o = {}; (f.fields || []).forEach(x => o[x.name] = nilaiAwal(x)); return o; }
  if (f.type === 'boolean') return false;
  if (f.type === 'number') return 0;
  return '';
}

/* Membuat satu medan isian yang terikat ke obj[f.name] */
function medan(f, obj, kunci) {
  if (obj[f.name] === undefined || obj[f.name] === null) obj[f.name] = nilaiAwal(f);
  const wrap = h('div', { class: 'medan' });
  if (f.list) {
    wrap.append(h('label', null, f.label), daftarMedan(f, obj, kunci));
  } else if (f.type === 'object') {
    const fs = h('fieldset', { class: 'grup' }, h('legend', null, f.label));
    (f.fields || []).forEach(x => fs.append(medan(x, obj[f.name], kunci)));
    wrap.append(fs);
  } else {
    if (f.type !== 'boolean') wrap.append(h('label', null, f.label));
    wrap.append(masukan(f, () => obj[f.name], v => obj[f.name] = v, kunci));
  }
  if (f.description) wrap.append(h('div', { class: 'ket' }, f.description));
  return wrap;
}

function masukan(f, ambil, set, kunci) {
  const v = ambil();
  switch (f.type) {
    case 'text': return h('textarea', { value: v || '', oninput: e => set(e.target.value) });
    case 'rich-text': return editorKaya(v || '', set);
    case 'date': return h('input', { type: 'date', value: v || '', oninput: e => set(e.target.value) });
    case 'number': return h('input', { type: 'number', value: v ?? '', oninput: e => set(Number(e.target.value)) });
    case 'boolean': return h('label', { style: 'display:flex;gap:8px;align-items:center;font-weight:500' },
      h('input', { type: 'checkbox', checked: !!v, onchange: e => set(e.target.checked) }), f.label);
    case 'select': {
      const opsi = [...(f.options || [])]; if (v && !opsi.includes(v)) opsi.unshift(v);
      return h('select', { onchange: e => set(e.target.value) }, h('option', { value: '' }, '— pilih —'),
        ...opsi.map(o => { const op = h('option', { value: o }, o); if (o === v) op.selected = true; return op; }));
    }
    case 'image': case 'file': return medanBerkas(f, ambil, set, kunci);
    case 'peta': return medanPeta(ambil, set);
    case 'video': return medanVideo(ambil, set);
    default: return h('input', { type: 'text', value: v ?? '', oninput: e => set(e.target.value) });
  }
}

function daftarMedan(f, obj, kunci) {
  const box = h('div', { class: 'daftar-item' });
  const arr = obj[f.name];
  const sederhana = f.type !== 'object';
  function gambar() {
    box.replaceChildren();
    arr.forEach((item, i) => {
      const kontrol = [
        h('button', { class: 'ikon-btn', title: 'Naikkan', type: 'button', disabled: i === 0, onclick: (e) => { e.stopPropagation(); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; gambar(); } }, '↑'),
        h('button', { class: 'ikon-btn', title: 'Turunkan', type: 'button', disabled: i === arr.length - 1, onclick: (e) => { e.stopPropagation(); [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; gambar(); } }, '↓'),
        h('button', { class: 'ikon-btn hapus', title: 'Hapus', type: 'button', onclick: (e) => { e.stopPropagation(); if (confirm('Hapus item ini?')) { arr.splice(i, 1); gambar(); } } }, '✕')];
      if (sederhana) {
        box.append(h('div', { class: 'baris-teks' },
          h('div', { style: 'flex:1' }, masukan(f, () => arr[i], val => arr[i] = val, kunci)), ...kontrol));
      } else {
        const judul = () => {
          const fs = f.fields || [];
          const p = fs.find(x => x.type === 'string' && item[x.name]) || fs.find(x => x.type === 'text' && item[x.name]);
          const t = String((p && item[p.name]) || '').replace(/\s+/g, ' ').trim();
          return t ? (t.length > 90 ? t.slice(0, 88) + '…' : t) : '(baru)';
        };
        const jd = h('span', { class: 'judul-item' }, (i + 1) + '. ' + judul());
        const badan = h('div', { class: 'badan-item' }, ...(f.fields || []).map(x => medan(x, item, kunci)));
        badan.addEventListener('input', () => jd.textContent = (i + 1) + '. ' + judul());
        const el = h('div', { class: 'item tutup' }, h('div', { class: 'kepala-item', onclick: () => el.classList.toggle('tutup') }, h('span', null, '▸'), jd, ...kontrol), badan);
        if (item.__baru) { el.classList.remove('tutup'); delete item.__baru; }
        box.append(el);
      }
    });
    box.append(h('div', null, h('button', { class: 'btn btn-garis btn-kecil', type: 'button', onclick: () => {
      const baru = sederhana ? '' : nilaiAwal({ ...f, list: false });
      if (!sederhana) baru.__baru = true;
      arr.push(baru); gambar();
    } }, '+ Tambah ' + (sederhana ? '' : 'item'))));
  }
  gambar();
  return box;
}

// Pastikan sesi login masih berlaku (diperbarui otomatis bila hampir habis)
async function pastikanSesi() {
  let { data: { session } } = await sb.auth.getSession();
  if (session && session.expires_at && session.expires_at * 1000 - Date.now() < 120000) {
    const r = await sb.auth.refreshSession(); session = r.data.session;
  }
  if (!session) throw new Error('jwt expired');
  sesi = session;
}

async function unggah(file, folder) {
  await pastikanSesi();
  const nama = (file.name || 'file').toLowerCase().normalize('NFKD').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(-60) || 'file';
  const jalur = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${nama}`;
  let hasil;
  for (let coba = 0; coba < 2; coba++) {
    hasil = await sb.storage.from('media').upload(jalur, file, { cacheControl: '31536000', upsert: false, contentType: file.type || undefined });
    if (!hasil.error || !/failed to fetch|network|load failed|timeout/i.test(hasil.error.message || '')) break;
  }
  if (hasil.error) throw hasil.error;
  return sb.storage.from('media').getPublicUrl(jalur).data.publicUrl;
}

function medanBerkas(f, ambil, set, kunci) {
  const gambar = f.type === 'image';
  const prev = h('div', { class: 'pratinjau' });
  const url = h('input', { type: 'text', value: ambil() || '', placeholder: gambar ? 'Belum ada foto' : 'Belum ada file' });
  const tampil = () => {
    const v = ambil();
    if (!gambar) { prev.replaceChildren(v ? h('a', { href: absolut(v), target: '_blank' }, '📄 Buka') : 'Tidak ada'); return; }
    prev.replaceChildren(v ? h('img', { src: absolut(v), alt: '' }) : 'Tidak ada foto');
  };
  url.addEventListener('change', () => { set(url.value.trim()); tampil(); });
  const label = h('span', { class: 'btn btn-garis btn-kecil' }, gambar ? '📷 Unggah foto' : '📎 Unggah file');
  const input = h('input', { type: 'file', accept: gambar ? 'image/*' : '' });
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    if (file.size > (gambar ? 40 : 20) * 1024 * 1024) { input.value = ''; return toast(`Ukuran file maksimal ${gambar ? 40 : 20} MB.`, true); }
    label.textContent = 'Mengunggah…';
    try {
      const siap = gambar ? await kecilkan(file) : file;
      if (gambar && !/^image\/(jpeg|png|webp|gif)$/.test(siap.type)) throw new Error('mime type not supported');
      if (siap.size > 20 * 1024 * 1024) throw new Error('exceeded the maximum allowed size');
      const u = await unggah(siap, kunci || 'umum');
      set(u); url.value = u; tampil(); tandaiKotor();
      toast('Foto terunggah. Klik "Simpan perubahan" agar tampil di website.');
    } catch (e) { toast('Gagal mengunggah: ' + pesanGalat(e), true); }
    label.textContent = gambar ? '📷 Unggah foto' : '📎 Unggah file'; input.value = '';
  });
  tampil();
  return h('div', { class: 'gambar-medan' }, prev, h('div', { class: 'kontrol' },
    h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, h('span', { class: 'unggah' }, label, input),
      h('button', { class: 'btn btn-merah btn-kecil', type: 'button', onclick: () => { set(''); url.value = ''; tampil(); } }, 'Kosongkan')),
    url));
}
// Isian lokasi Google Maps: tempel link/kode sematan/koordinat/alamat, langsung ada pratinjau
function medanPeta(ambil, set) {
  const isi = h('textarea', { rows: 2, placeholder: 'Contoh: https://maps.app.goo.gl/…  atau  https://www.google.com/maps/place/…', value: ambil() || '' });
  const status = h('div', { class: 'ket' });
  const prev = h('div', { class: 'peta-pratinjau' });
  const tampil = () => {
    const v = (ambil() || '').trim();
    const r = v ? window.bacaPeta(v) : null;
    prev.replaceChildren();
    status.style.color = '';
    if (!v) { status.textContent = 'Kosong: peta di website memakai alamat sekolah.'; return; }
    if (!r) { status.style.color = '#b91c1c'; status.textContent = '✗ Isian ini tidak dikenali sebagai lokasi Google Maps. Tempel link dari tombol Bagikan di Google Maps.'; return; }
    if (r.pendek) {
      status.style.color = '#047857';
      status.replaceChildren('✓ Link Google Maps diterima. Peta tampil di website ±3 menit setelah Simpan (pratinjau tidak tersedia untuk link pendek). ',
        h('a', { href: r.link, target: '_blank', rel: 'noopener' }, 'Cek link'));
      return;
    }
    status.style.color = '#047857'; status.textContent = '✓ Lokasi terbaca. Pratinjau:';
    prev.append(h('iframe', { src: r.embed, loading: 'lazy', title: 'Pratinjau peta', style: 'border:0;width:100%;height:240px;border-radius:10px;margin-top:6px' }));
  };
  let t;
  isi.addEventListener('input', () => { set(isi.value.trim()); clearTimeout(t); t = setTimeout(tampil, 600); });
  tampil();
  return h('div', null, isi, status, prev);
}
// Isian link video: langsung dikenali dan diberi pratinjau pemutar
function medanVideo(ambil, set) {
  const isi = h('input', { type: 'url', placeholder: 'Contoh: https://youtu.be/…  atau  https://www.instagram.com/reel/…', value: ambil() || '' });
  const status = h('div', { class: 'ket' });
  const prev = h('div');
  const NAMA = { youtube: 'YouTube', drive: 'Google Drive', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', file: 'file video' };
  const tampil = () => {
    const v = (ambil() || '').trim();
    const r = v ? window.bacaVideo(v) : null;
    prev.replaceChildren(); status.style.color = '';
    if (!v) { status.textContent = 'Kosong: testimoni tampil tanpa video.'; return; }
    if (!r) { status.style.color = '#b91c1c'; status.textContent = '✗ Link ini tidak dikenali. Gunakan link video YouTube, Google Drive, Instagram, TikTok, atau Facebook.'; return; }
    status.style.color = '#047857';
    if (r.pendek) { status.textContent = '✓ Link video diterima. Pemutar muncul di website ±3 menit setelah Simpan (pratinjau tidak tersedia untuk link pendek).'; return; }
    status.textContent = '✓ Video ' + NAMA[r.jenis] + ' terbaca.' + (r.jenis === 'drive' ? ' Pastikan file Drive dibagikan ke "Siapa saja yang memiliki link".' : '') + ' Pratinjau:';
    const gaya = 'border:0;display:block;margin-top:6px;border-radius:10px;background:#000;' + (r.tegak ? 'width:240px;height:426px' : 'width:100%;max-width:480px;aspect-ratio:16/9');
    prev.append(r.jenis === 'file' ? h('video', { src: r.embed, controls: true, style: gaya }) : h('iframe', { src: r.embed, loading: 'lazy', allowfullscreen: true, title: 'Pratinjau video', style: gaya }));
  };
  let t;
  isi.addEventListener('input', () => { set(isi.value.trim()); clearTimeout(t); t = setTimeout(tampil, 600); });
  tampil();
  return h('div', null, isi, status, prev);
}
function absolut(v) { return /^https?:/i.test(v) ? v : SITUS + String(v).replace(/^\//, ''); }

/* Perkecil foto besar sebelum diunggah (hemat kuota & cepat dibuka) */
// Foto dengan format lain (mis. HEIC dari iPhone) diubah ke JPG bila browser bisa membukanya.
function kecilkan(file, maks = 1600) {
  return new Promise((res) => {
    if (file.type === 'image/gif') return res(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const s = Math.min(1, maks / Math.max(img.width, img.height));
      if (s === 1 && file.size < 900 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return res(file);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => res(b ? new File([b], (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.85);
    };
    img.onerror = () => res(file);
    img.src = URL.createObjectURL(file);
  });
}

function editorKaya(html, set) {
  const isi = h('div', { class: 'editor-isi', contenteditable: 'true' });
  isi.innerHTML = html;
  const simpan = () => set(isi.innerHTML);
  isi.addEventListener('input', simpan);
  const cmd = (c, v) => () => { isi.focus(); document.execCommand(c, false, v); simpan(); };
  const fotoInput = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  fotoInput.addEventListener('change', async () => {
    const f = fotoInput.files[0]; if (!f) return;
    try { const u = await unggah(await kecilkan(f), 'berita'); isi.focus(); document.execCommand('insertImage', false, u); simpan(); toast('Foto disisipkan.'); }
    catch (e) { toast('Gagal mengunggah: ' + pesanGalat(e), true); }
    fotoInput.value = '';
  });
  const alat = h('div', { class: 'alat' },
    h('button', { type: 'button', title: 'Tebal', onclick: cmd('bold') }, h('b', null, 'B')),
    h('button', { type: 'button', title: 'Miring', onclick: cmd('italic') }, h('i', null, 'I')),
    h('button', { type: 'button', title: 'Subjudul', onclick: cmd('formatBlock', 'h3') }, 'Subjudul'),
    h('button', { type: 'button', title: 'Paragraf', onclick: cmd('formatBlock', 'p') }, '¶'),
    h('button', { type: 'button', title: 'Daftar', onclick: cmd('insertUnorderedList') }, '• Daftar'),
    h('button', { type: 'button', title: 'Daftar nomor', onclick: cmd('insertOrderedList') }, '1. Daftar'),
    h('button', { type: 'button', title: 'Tautan', onclick: () => { const u = prompt('Alamat tautan (https://...)'); if (u) cmd('createLink', u)(); } }, '🔗 Tautan'),
    h('button', { type: 'button', title: 'Sisipkan foto', onclick: () => fotoInput.click() }, '📷 Foto'),
    h('button', { type: 'button', title: 'Hapus format', onclick: cmd('removeFormat') }, '⌫ Format'), fotoInput);
  return h('div', null, alat, isi);
}

/* ---------- Berita ---------- */
async function halamanBerita() {
  kerangka('📰 Berita', 'Memuat…');
  const { data, error } = await sb.from('berita').select('id, judul, tanggal, kategori, terbit').order('tanggal', { ascending: false });
  if (error) return kerangka('📰 Berita', null, h('div', { class: 'pesan galat' }, pesanGalat(error)));
  const tbody = h('tbody');
  (data || []).forEach(b => tbody.append(h('tr', null,
    h('td', { style: 'white-space:nowrap' }, new Date(b.tanggal + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })),
    h('td', null, h('a', { href: '#/berita/' + b.id }, b.judul)),
    h('td', null, b.kategori || ''),
    h('td', null, h('span', { class: 'status ' + (b.terbit ? 'ya' : 'tidak') }, b.terbit ? 'Terbit' : 'Draf')),
    h('td', { style: 'white-space:nowrap' }, h('a', { class: 'btn btn-garis btn-kecil', href: '#/berita/' + b.id }, 'Edit'), ' ',
      h('button', { class: 'btn btn-merah btn-kecil', onclick: async () => {
        if (!confirm('Hapus berita "' + b.judul + '"? Tindakan ini tidak bisa dibatalkan.')) return;
        const { error } = await sb.from('berita').delete().eq('id', b.id);
        if (error) return toast('Gagal menghapus: ' + pesanGalat(error), true);
        toast('Berita dihapus.'); halamanBerita();
      } }, 'Hapus')))));
  kerangka('📰 Berita', (data || []).length + ' berita',
    h('p', { style: 'margin-bottom:14px' }, h('a', { class: 'btn btn-emas', href: '#/berita/baru' }, '+ Tulis berita baru')),
    h('div', { class: 'panel tabel-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Tanggal'), h('th', null, 'Judul'), h('th', null, 'Kategori'), h('th', null, 'Status'), h('th', null, ''))), tbody)));
}

async function halamanBeritaForm(id) {
  const baru = id === 'baru';
  let b = { judul: '', tanggal: new Date().toISOString().slice(0, 10), kategori: 'Kegiatan', gambar: '', ringkasan: '', isi: '', terbit: true };
  if (!baru) {
    kerangka('📰 Edit berita', 'Memuat…');
    const { data, error } = await sb.from('berita').select('*').eq('id', id).maybeSingle();
    if (error || !data) return kerangka('📰 Berita', null, h('div', { class: 'pesan galat' }, error ? pesanGalat(error) : 'Berita tidak ditemukan.'));
    b = data;
  }
  const F = [
    { name: 'judul', label: 'Judul berita', type: 'string' },
    { name: 'tanggal', label: 'Tanggal', type: 'date' },
    { name: 'kategori', label: 'Kategori', type: 'select', options: KATEGORI_BERITA },
    { name: 'gambar', label: 'Foto utama', type: 'image', description: 'Opsional. Foto mendatar terlihat paling bagus.' },
    { name: 'ringkasan', label: 'Ringkasan singkat', type: 'text', description: '1–2 kalimat yang tampil di daftar berita.' },
    { name: 'isi', label: 'Isi berita', type: 'rich-text' },
    { name: 'terbit', label: 'Terbitkan di website (hilangkan centang untuk menyimpan sebagai draf)', type: 'boolean' }];
  const form = h('div', { class: 'panel' }, ...F.map(f => medan(f, b, 'berita')));
  form.addEventListener('input', tandaiKotor);
  const btn = h('button', { class: 'btn btn-emas' }, '💾 Simpan berita');
  btn.addEventListener('click', async () => {
    if (!b.judul.trim()) return toast('Judul berita wajib diisi.', true);
    sibuk(btn, true, 'Menyimpan…');
    try { await pastikanSesi(); } catch (e) { sibuk(btn, false, '💾 Simpan berita'); return toast('Gagal menyimpan: ' + pesanGalat(e), true); }
    const isian = { judul: b.judul.trim(), tanggal: b.tanggal, kategori: b.kategori, gambar: b.gambar, ringkasan: b.ringkasan, isi: b.isi, terbit: b.terbit, diubah: new Date().toISOString() };
    if (baru) isian.slug = slugify(b.judul);
    const { data, error } = baru ? await sb.from('berita').insert(isian).select() : await sb.from('berita').update(isian).eq('id', id).select();
    sibuk(btn, false, '💾 Simpan berita');
    if (error || !data || !data.length) return toast('Gagal menyimpan: ' + (error ? pesanGalat(error) : 'tidak ada akses'), true);
    kotor = false;
    toast('Berita tersimpan. Tampil di website dalam ±3 menit.');
    location.hash = '#/berita';
  });
  kerangka(baru ? '📰 Tulis berita baru' : '📰 Edit berita', null, form,
    h('div', { class: 'aksi-simpan' }, btn, h('a', { class: 'btn btn-garis', href: '#/berita' }, 'Batal')));
}

/* ---------- Pengguna (admin) ---------- */
function opsiPeran(pilihan) {
  return semuaPeran.map(r => { const o = h('option', { value: r.kode }, r.nama); if (r.kode === pilihan) o.selected = true; return o; });
}

async function halamanPengguna() {
  kerangka('👥 Pengguna', 'Memuat…');
  const [{ data: org, error }, { data: rs }] = await Promise.all([
    sb.from('profil').select('*').order('dibuat'), sb.from('peran').select('*').order('urutan')]);
  if (error) return kerangka('👥 Pengguna', null, h('div', { class: 'pesan galat' }, pesanGalat(error)));
  semuaPeran = rs || semuaPeran;
  const linkDaftar = location.href.split('#')[0];
  const tbody = h('tbody');
  (org || []).forEach(p => {
    const nama = h('input', { type: 'text', value: p.nama || '' });
    const pilih = h('select', null, ...opsiPeran(p.peran));
    const aktif = h('input', { type: 'checkbox', checked: p.aktif, title: 'Aktif' });
    const diriSendiri = p.id === sesi.user.id;
    if (diriSendiri) { pilih.disabled = true; aktif.disabled = true; }
    const simpan = h('button', { class: 'btn btn-kecil', onclick: async () => {
      sibuk(simpan, true);
      const { data, error } = await sb.from('profil').update({ nama: nama.value.trim(), peran: pilih.value, aktif: aktif.checked }).eq('id', p.id).select();
      sibuk(simpan, false);
      if (error || !data.length) return toast('Gagal: ' + (error ? pesanGalat(error) : 'tidak ada akses'), true);
      toast('Akun ' + (nama.value || p.email) + ' diperbarui.');
    } }, 'Simpan');
    const sandi = diriSendiri ? '' : h('button', { class: 'btn btn-garis btn-kecil', title: 'Buat password baru untuk akun ini', onclick: async () => {
      const pw = prompt('Password baru untuk ' + p.email + ' (minimal 6 karakter).\nSampaikan password ini kepada pemilik akun.');
      if (pw == null) return;
      if (pw.length < 6) return toast('Password minimal 6 karakter.', true);
      const { error } = await sb.rpc('admin_atur_password', { pengguna: p.id, password_baru: pw });
      if (error) return toast('Gagal: ' + pesanGalat(error), true);
      toast('Password ' + p.email + ' sudah diganti.');
    } }, '🔑 Password');
    const hapus = diriSendiri ? '' : h('button', { class: 'btn btn-merah btn-kecil', onclick: async () => {
      if (!confirm('Hapus akun ' + p.email + '? Akun ini tidak bisa masuk lagi. Berita yang pernah ditulisnya tetap ada. Tindakan ini tidak bisa dibatalkan.')) return;
      const { error } = await sb.rpc('admin_hapus_akun', { pengguna: p.id });
      if (error) return toast('Gagal: ' + pesanGalat(error), true);
      toast('Akun dihapus.'); halamanPengguna();
    } }, 'Hapus');
    tbody.append(h('tr', null, h('td', null, nama), h('td', null, p.email, diriSendiri ? h('span', { class: 'lencana' }, 'Anda') : ''), h('td', null, pilih),
      h('td', { class: 'tengah' }, aktif), h('td', { style: 'white-space:nowrap' }, simpan, ' ', sandi, ' ', hapus)));
  });
  const menunggu = (org || []).filter(p => p.peran === 'menunggu').length;

  // Form tambah akun langsung oleh admin
  const tNama = h('input', { type: 'text', required: true, placeholder: 'Nama lengkap' });
  const tEmail = h('input', { type: 'email', required: true, placeholder: 'nama@email.com', autocomplete: 'off' });
  const tPw = h('input', { type: 'text', required: true, minlength: 6, placeholder: 'Minimal 6 karakter', autocomplete: 'off' });
  const tPeran = h('select', null, ...opsiPeran('guru').filter(o => o.value !== 'menunggu'));
  const tBtn = h('button', { class: 'btn btn-emas', type: 'submit' }, '+ Buat akun');
  const tambah = h('form', { class: 'form-tambah', onsubmit: async (e) => {
    e.preventDefault(); sibuk(tBtn, true, 'Membuat akun…');
    try {
      const sb2 = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-tambah-akun' } });
      const { data, error } = await sb2.auth.signUp({ email: tEmail.value.trim(), password: tPw.value, options: { data: { nama: tNama.value.trim() } } });
      if (error) throw error;
      if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('Email ini sudah terdaftar.');
      const uid = data.user.id;
      if (!data.session) { const r = await sb.rpc('admin_atur_password', { pengguna: uid, password_baru: tPw.value }); if (r.error) throw r.error; }
      const { error: e2 } = await sb.from('profil').update({ nama: tNama.value.trim(), peran: tPeran.value, aktif: true }).eq('id', uid);
      if (e2) throw e2;
      toast('Akun ' + tEmail.value.trim() + ' dibuat. Sampaikan email & password kepada pemiliknya.');
      halamanPengguna();
    } catch (err) { toast('Gagal membuat akun: ' + pesanGalat(err), true); sibuk(tBtn, false, '+ Buat akun'); }
  } }, h('div', null, h('label', null, 'Nama'), tNama), h('div', null, h('label', null, 'Email'), tEmail),
    h('div', null, h('label', null, 'Password awal'), tPw), h('div', null, h('label', null, 'Peran'), tPeran), h('div', null, tBtn));

  kerangka('👥 Pengguna', 'Buat akun guru/pegawai, atur perannya, ganti password, atau hapus akun.',
    menunggu ? h('div', { class: 'pesan peringatan', style: 'margin-bottom:14px' }, menunggu + ' akun menunggu persetujuan. Pilih perannya lalu klik Simpan.') : null,
    h('div', { class: 'panel' }, h('h2', null, 'Buat akun baru'), tambah,
      h('p', { class: 'ket', style: 'margin-top:12px' }, 'Atau minta guru/pegawai mendaftar sendiri lewat link ini, lalu setujui akunnya di tabel di bawah:'),
      h('div', { style: 'display:flex;gap:8px;margin-top:6px;flex-wrap:wrap' }, h('input', { type: 'text', value: linkDaftar, readonly: true, style: 'flex:1;min-width:220px' }),
        h('button', { class: 'btn btn-garis', onclick: () => { navigator.clipboard.writeText(linkDaftar).then(() => toast('Link disalin.')); } }, 'Salin link'))),
    h('div', { class: 'panel tabel-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Nama'), h('th', null, 'Email'), h('th', null, 'Peran'), h('th', { class: 'tengah' }, 'Aktif'), h('th', null, ''))), tbody)));
}

/* ---------- Peran & hak akses (admin) ---------- */
async function halamanPeran() {
  kerangka('🔐 Peran & Hak Akses', 'Memuat…');
  const { data: rs, error } = await sb.from('peran').select('*').order('urutan');
  if (error) return kerangka('🔐 Peran & Hak Akses', null, h('div', { class: 'pesan galat' }, pesanGalat(error)));
  semuaPeran = rs;
  const bagian = semuaBagian();
  const thead = h('tr', null, h('th', null, 'Peran'), h('th', { class: 'putar' }, 'Semua akses (Admin)'), ...bagian.map(b => h('th', { class: 'putar', title: b.label }, b.label)), h('th', null, ''));
  const tbody = h('tbody');
  rs.forEach(r => {
    const akses = new Set(r.akses);
    const terkunci = r.kode === 'admin' || r.kode === 'menunggu';
    const nama = h('input', { type: 'text', value: r.nama, style: 'min-width:150px', readonly: terkunci });
    const cbSemua = h('input', { type: 'checkbox', checked: akses.has('*'), disabled: terkunci });
    const cbs = bagian.map(b => h('input', { type: 'checkbox', checked: akses.has('*') || akses.has(b.kunci), disabled: terkunci || akses.has('*'), 'data-k': b.kunci }));
    cbSemua.addEventListener('change', () => cbs.forEach(c => { c.disabled = cbSemua.checked; if (cbSemua.checked) c.checked = true; }));
    const simpan = h('button', { class: 'btn btn-kecil', onclick: async () => {
      const baru = cbSemua.checked ? ['*'] : cbs.filter(c => c.checked).map(c => c.dataset.k);
      sibuk(simpan, true);
      const { data, error } = await sb.from('peran').update({ nama: nama.value.trim() || r.nama, akses: baru }).eq('kode', r.kode).select();
      sibuk(simpan, false);
      if (error || !data.length) return toast('Gagal: ' + (error ? pesanGalat(error) : 'tidak ada akses'), true);
      toast('Hak akses "' + nama.value + '" disimpan.');
    } }, 'Simpan');
    const hapus = terkunci ? '' : h('button', { class: 'btn btn-merah btn-kecil', onclick: async () => {
      if (!confirm('Hapus peran "' + r.nama + '"? Pastikan tidak ada akun yang masih memakai peran ini.')) return;
      const { error } = await sb.from('peran').delete().eq('kode', r.kode);
      if (error) return toast(/foreign key|violates/i.test(error.message) ? 'Masih ada akun dengan peran ini. Ubah peran akun tersebut dulu.' : 'Gagal: ' + pesanGalat(error), true);
      toast('Peran dihapus.'); halamanPeran();
    } }, 'Hapus');
    tbody.append(h('tr', null, h('td', null, nama, h('div', { style: 'font-size:.72rem;color:var(--abu)' }, 'kode: ' + r.kode)),
      h('td', { class: 'tengah' }, cbSemua), ...cbs.map(c => h('td', { class: 'tengah' }, c)),
      h('td', { style: 'white-space:nowrap' }, terkunci ? h('small', { style: 'color:var(--abu)' }, 'bawaan') : [simpan, ' ', hapus])));
  });
  const namaBaru = h('input', { type: 'text', placeholder: 'Contoh: Musyrifah, Panitia PPDB, Humas' });
  const tambah = h('button', { class: 'btn', onclick: async () => {
    const n = namaBaru.value.trim(); if (!n) return toast('Isi nama peran.', true);
    const kode = slugify(n).replace(/-/g, '_');
    const { error } = await sb.from('peran').insert({ kode, nama: n, akses: [], urutan: 50 });
    if (error) return toast(/duplicate/i.test(error.message) ? 'Peran dengan nama itu sudah ada.' : 'Gagal: ' + pesanGalat(error), true);
    toast('Peran "' + n + '" ditambahkan. Centang bagian yang boleh dikelola lalu Simpan.'); halamanPeran();
  } }, '+ Tambah peran');
  kerangka('🔐 Peran & Hak Akses', 'Centang bagian yang boleh dikelola setiap peran (buka/tutup akses), lalu klik Simpan pada baris tersebut.',
    h('div', { class: 'panel tabel-wrap' }, h('table', { class: 'matriks' }, h('thead', null, thead), tbody)),
    h('div', { class: 'panel' }, h('h2', null, 'Tambah peran baru'), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, h('div', { style: 'flex:1;min-width:220px' }, namaBaru), tambah)),
    h('div', { class: 'pesan info' }, 'Peran "Admin" selalu memiliki semua akses, termasuk mengatur pengguna dan peran. Peran "Menunggu persetujuan" tidak memiliki akses apa pun.'));
}

/* ---------- Pengaturan akun ---------- */
function halamanAkun() {
  const nama = h('input', { type: 'text', value: profil.nama || '' });
  const btnNama = h('button', { class: 'btn' }, 'Simpan nama');
  btnNama.addEventListener('click', async () => {
    sibuk(btnNama, true);
    const { error } = await sb.rpc('ubah_nama_saya', { nama_baru: nama.value.trim() });
    sibuk(btnNama, false);
    if (error) return toast('Gagal: ' + pesanGalat(error), true);
    profil.nama = nama.value.trim(); toast('Nama disimpan.'); halamanAkun();
  });
  kerangka('⚙️ Pengaturan Akun', null,
    h('div', { class: 'panel' }, h('h2', null, 'Profil'),
      h('div', { class: 'medan' }, h('label', null, 'Email'), h('input', { type: 'email', value: profil.email || sesi.user.email, readonly: true })),
      h('div', { class: 'medan' }, h('label', null, 'Peran'), h('input', { type: 'text', value: peranSaya.nama, readonly: true })),
      h('div', { class: 'medan' }, h('label', null, 'Nama tampilan'), nama), btnNama),
    h('div', { class: 'panel' }, h('h2', null, 'Ganti password'), tampilGantiPassword(false)));
}

/* ---------- Pendaftar PPDB online (panitia) ---------- */
const tabelBelumAda = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message || ''));
const PESAN_BELUM_PASANG = 'Fitur PPDB online belum dipasang di database. Jalankan file supabase/ppdb-online.sql di Supabase → SQL Editor (sekali saja).';
const ST = () => window.PPDB_STATUS;
function lencanaStatus(jenis, nilai) {
  const warna = { diterima: 'hijau', lulus: 'hijau', menunggu: 'biru', ditolak: 'merah', tidak_lulus: 'merah', cadangan: 'kuning' }[nilai] || 'abu';
  return h('span', { class: 'lencana-st ' + warna }, (ST()[jenis] || {})[nilai] || nilai || '-');
}
function tglId(t) { return t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
function waLink(n) { let d = String(n || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); return d ? 'https://wa.me/' + d : null; }
async function bukaBerkasPpdb(jalur) {
  const w = window.open('', '_blank');
  const { data, error } = await sb.storage.from('ppdb').createSignedUrl(jalur, 600);
  if (error || !data) { if (w) w.close(); return toast('Berkas tidak bisa dibuka: ' + (error ? pesanGalat(error) : ''), true); }
  if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
}

async function halamanPendaftar() {
  const judul = '🧾 Pendaftar PPDB';
  kerangka(judul, 'Memuat…');
  const awal0 = location.hash;
  const { data, error } = await sb.from('pendaftar').select('*').order('dibuat', { ascending: false });
  if (location.hash !== awal0) return;
  if (error) return kerangka(judul, null, h('div', { class: 'pesan ' + (tabelBelumAda(error) ? 'peringatan' : 'galat') }, tabelBelumAda(error) ? PESAN_BELUM_PASANG : pesanGalat(error)));
  const semua = data || [];
  const n = (f) => semua.filter(f).length;
  const ringkas = h('div', { class: 'ringkas-ppdb' }, [
    ['Total pendaftar', semua.length], ['Bukti bayar perlu dicek', n(x => x.status_bayar === 'menunggu')],
    ['Wawancara lengkap', n(x => x.wawancara_lengkap)], ['Lulus tes awal', n(x => x.tes_awal === 'lulus')], ['Dinyatakan LULUS', n(x => x.kelulusan === 'lulus')],
  ].map(([t, v]) => h('div', null, h('b', null, v), h('small', null, t))));
  const FILTER = {
    semua: ['Semua pendaftar', () => true],
    bayar: ['Perlu cek bukti bayar', x => x.status_bayar === 'menunggu'],
    belum_bayar: ['Belum bayar / ditolak', x => x.status_bayar === 'belum' || x.status_bayar === 'ditolak'],
    proses: ['Sedang mengisi data', x => (x.status_bayar === 'menunggu' || x.status_bayar === 'diterima') && !x.wawancara_lengkap],
    tes_awal: ['Menunggu hasil tes awal', x => x.wawancara_lengkap && x.tes_awal === 'belum'],
    tes_akhir: ['Menunggu hasil tes akhir', x => x.tes_awal === 'lulus' && x.tes_akhir === 'belum'],
    lulus: ['Lulus', x => x.kelulusan === 'lulus'], cadangan: ['Cadangan', x => x.kelulusan === 'cadangan'], tidak: ['Tidak lulus', x => x.kelulusan === 'tidak_lulus'],
  };
  const pilihF = h('select', null, Object.entries(FILTER).map(([k, [t]]) => h('option', { value: k }, t)));
  const pilihJ = h('select', null, h('option', { value: '' }, 'Semua jenjang'), h('option', { value: 'SMP' }, 'SMP'), h('option', { value: 'SMA' }, 'SMA'));
  const cari = h('input', { type: 'search', placeholder: 'Cari nama, nomor, atau email…' });
  const tbody = h('tbody');
  let tersaring = semua;
  const gambar = () => {
    const q = cari.value.trim().toLowerCase();
    tersaring = semua.filter(FILTER[pilihF.value][1]).filter(x => !pilihJ.value || x.jenjang === pilihJ.value)
      .filter(x => !q || [x.nama, x.nomor, x.email, x.no_wa].some(v => String(v || '').toLowerCase().includes(q)));
    tbody.replaceChildren(...(tersaring.length ? tersaring.map(x => h('tr', { class: 'baris-klik', onclick: () => { location.hash = '#/pendaftar/' + x.id; } },
      h('td', null, h('b', null, x.nomor || '-'), h('br'), h('small', null, tglId(x.dibuat))),
      h('td', null, h('b', null, x.nama || '(tanpa nama)'), h('br'), h('small', null, x.email || '')),
      h('td', null, x.jenjang ? x.jenjang + ' · ' + x.program : h('small', null, 'Belum memilih')),
      h('td', null, lencanaStatus('bayar', x.status_bayar)),
      h('td', null, (x.biodata_lengkap ? '✅' : '⬜') + ' / ' + (x.wawancara_lengkap ? '✅' : '⬜')),
      h('td', null, lencanaStatus('tes', x.tes_awal)), h('td', null, lencanaStatus('tes', x.tes_akhir)),
      h('td', null, lencanaStatus('kelulusan', x.kelulusan)))) : [h('tr', null, h('td', { colspan: 8, style: 'text-align:center;color:var(--abu);padding:24px' }, 'Tidak ada pendaftar.'))]));
    ingatUrutan(tersaring, '#/pendaftar');
  };
  [pilihF, pilihJ].forEach(el => el.addEventListener('change', gambar));
  cari.addEventListener('input', gambar);
  gambar();
  const unduh = h('button', { class: 'btn btn-garis btn-kecil', type: 'button', onclick: () => unduhCsvPendaftar(tersaring) }, '⬇️ Unduh data (Excel/CSV)');
  kerangka(judul, 'Klik nama pendaftar untuk melihat berkas, biodata, wawancara, mengisi nilai, dan mengubah status seleksi.',
    tabPpdb('daftar'), ringkas,
    h('div', { class: 'panel' },
      h('div', { class: 'alat-ppdb' }, pilihF, pilihJ, cari, unduh),
      h('div', { class: 'tabel-wrap' }, h('table', { class: 'tabel-ppdb' },
        h('thead', null, h('tr', null, ['No. / Tanggal', 'Nama', 'Pilihan', 'Pembayaran', 'Biodata / Wawancara', 'Tes awal', 'Tes akhir', 'Kelulusan'].map(t => h('th', null, t)))), tbody))),
    await panelGrupWa());
}

async function panelGrupWa() {
  const box = h('div', { class: 'panel' }, h('h3', null, '💬 Link grup WhatsApp calon santri'),
    h('p', { class: 'ket' }, 'Link ini hanya terlihat oleh calon santri yang sudah mengisi formulir wawancara (langkah 07). Contoh link: https://chat.whatsapp.com/…'));
  const { data, error } = await sb.from('ppdb_rahasia').select('grup_wa').eq('id', 1).maybeSingle();
  if (error) { box.append(h('div', { class: 'pesan galat' }, pesanGalat(error))); return box; }
  const grup = salin((data && data.grup_wa) || []);
  const daftar = h('div');
  const gambar = () => daftar.replaceChildren(...grup.map((g, i) => h('div', { class: 'baris-grup' },
    h('input', { type: 'text', placeholder: 'Nama grup, mis. Grup PPDB SMP', value: g.nama || '', oninput: e => { g.nama = e.target.value; } }),
    h('input', { type: 'url', placeholder: 'https://chat.whatsapp.com/…', value: g.link || '', oninput: e => { g.link = e.target.value.trim(); } }),
    h('button', { class: 'ikon-btn hapus', type: 'button', title: 'Hapus', onclick: () => { grup.splice(i, 1); gambar(); } }, '✕'))));
  gambar();
  const btn = h('button', { class: 'btn btn-emas btn-kecil', type: 'button', onclick: async () => {
    const bersihGrup = grup.filter(g => g.link);
    if (bersihGrup.some(g => !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//i.test(g.link))) return toast('Link grup harus diawali https://chat.whatsapp.com/', true);
    sibuk(btn, true, 'Menyimpan…');
    const { data: d2, error: e2 } = await sb.from('ppdb_rahasia').upsert({ id: 1, grup_wa: bersihGrup, diubah: new Date().toISOString() }).select();
    sibuk(btn, false, '💾 Simpan link grup');
    if (e2 || !d2 || !d2.length) return toast('Gagal menyimpan: ' + (e2 ? pesanGalat(e2) : 'tidak ada akses'), true);
    toast('Link grup WhatsApp disimpan.');
  } }, '💾 Simpan link grup');
  box.append(daftar, h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px' },
    h('button', { class: 'btn btn-garis btn-kecil', type: 'button', onclick: () => { grup.push({ nama: '', link: '' }); gambar(); } }, '+ Tambah grup'), btn));
  return box;
}

function unduhCsvPendaftar(baris) {
  const bio = (window.PPDB_BIODATA || []).flatMap(g => g.isian);
  const tanya = [...new Set(baris.flatMap(x => Object.keys(x.wawancara || {})))];
  const kolom = [['Nomor', x => x.nomor], ['Tanggal daftar', x => tglId(x.dibuat)], ['Nama', x => x.nama], ['Email', x => x.email], ['No. WA', x => x.no_wa],
    ['Jenjang', x => x.jenjang], ['Program', x => x.program], ['Pembayaran', x => ST().bayar[x.status_bayar]],
    ...bio.map(([k, label]) => [label, x => (x.biodata || {})[k]]),
    ...tanya.map(q => ['Wawancara: ' + q, x => (x.wawancara || {})[q]]),
    ['Gabung grup WA', x => x.gabung_grup ? 'Ya' : 'Belum'], ['Tes awal', x => ST().tes[x.tes_awal]], ['Tes akhir', x => ST().tes[x.tes_akhir]],
    ['Kelulusan', x => ST().kelulusan[x.kelulusan]], ['Pesan panitia', x => x.pesan_panitia]];
  const sel = (v) => { let t = String(v == null ? '' : v).replace(/\r?\n/g, ' '); if (/^[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const csv = [kolom.map(k => sel(k[0])).join(';'), ...baris.map(x => kolom.map(k => sel(k[1](x))).join(';'))].join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })), download: 'pendaftar-ppdb-' + new Date().toISOString().slice(0, 10) + '.csv' });
  document.body.append(a); a.click(); a.remove();
}

async function halamanPendaftarDetail(id, keNilai) {
  kerangka('🧾 Data pendaftar', 'Memuat…');
  const awal0 = location.hash;
  const { data: x, error } = await sb.from('pendaftar').select('*').eq('id', id).maybeSingle();
  if (location.hash !== awal0) return;
  const asal = bacaSesi('asal-ppdb') === '#/pendaftar/nilai' ? ['#/pendaftar/nilai', '← Kembali ke rekap nilai'] : ['#/pendaftar', '← Kembali ke daftar pendaftar'];
  if (error || !x) return kerangka('🧾 Data pendaftar', null, h('div', { class: 'pesan galat' }, error ? (tabelBelumAda(error) ? PESAN_BELUM_PASANG : pesanGalat(error)) : 'Pendaftar tidak ditemukan.'),
    h('a', { href: asal[0] }, asal[1]));
  const [navigasi, nilaiPanel] = await Promise.all([navigasiPendaftar(id, keNilai), panelNilai(x)]);
  if (location.hash !== awal0) return;
  const ubah = { status_bayar: x.status_bayar, tes_awal: x.tes_awal, tes_akhir: x.tes_akhir, kelulusan: x.kelulusan, pesan_panitia: x.pesan_panitia || '' };
  const pilih = (kolom, jenis, label, ket) => h('div', { class: 'medan' }, h('label', null, label),
    h('select', { onchange: e => { ubah[kolom] = e.target.value; tandaiKotor(); } },
      Object.entries(ST()[jenis]).map(([k, t]) => h('option', { value: k, selected: ubah[kolom] === k }, t))), ket ? h('div', { class: 'ket' }, ket) : null);
  const btn = h('button', { class: 'btn btn-emas', type: 'button', onclick: async () => {
    sibuk(btn, true, 'Menyimpan…');
    const { data: d2, error: e2 } = await sb.from('pendaftar').update(ubah).eq('id', id).select();
    sibuk(btn, false, '💾 Simpan status');
    if (e2 || !d2 || !d2.length) return toast('Gagal menyimpan: ' + (e2 ? pesanGalat(e2) : 'tidak ada akses'), true);
    kotor = false; toast('Status pendaftar disimpan. Calon santri langsung melihatnya di dashboard.');
  } }, '💾 Simpan status');
  const tombolBerkas = (jalur, teks) => jalur ? h('button', { class: 'btn btn-garis btn-kecil', type: 'button', onclick: () => bukaBerkasPpdb(jalur) }, teks) : h('small', { style: 'color:var(--abu)' }, 'Belum diunggah');
  const bio = x.biodata || {};
  const biodata = (window.PPDB_BIODATA || []).map(g => h('div', { class: 'grup-data' }, h('h4', null, g.judul),
    h('dl', { class: 'data-ppdb' }, g.isian.flatMap(([k, label]) => [h('dt', null, label), h('dd', null, bio[k] || '-')]))));
  const waw = Object.entries(x.wawancara || {});
  const hp = waLink(x.no_wa);
  const hapus = h('button', { class: 'btn btn-merah btn-kecil', type: 'button', onclick: async () => {
    if (!confirm('Hapus data pendaftar ' + (x.nama || x.email) + '? ' + (adalahAdmin() ? 'Akunnya juga ikut dihapus. ' : '') + 'Tindakan ini tidak bisa dibatalkan.')) return;
    const { error: e3 } = adalahAdmin() ? await sb.rpc('admin_hapus_akun', { pengguna: id }) : await sb.from('pendaftar').delete().eq('id', id);
    if (e3) return toast('Gagal menghapus: ' + pesanGalat(e3), true);
    toast('Pendaftar dihapus.'); kotor = false; location.hash = '#/pendaftar';
  } }, 'Hapus pendaftar');
  kerangka('🧾 ' + (x.nama || 'Pendaftar'), null,
    h('div', { class: 'nav-pendaftar' }, h('a', { href: asal[0] }, asal[1]), navigasi),
    h('div', { class: 'panel' }, h('div', { class: 'kepala-ppdb' },
      h('div', null, h('small', null, 'No. pendaftaran'), h('b', null, x.nomor || '-')),
      h('div', null, h('small', null, 'Email'), h('b', null, x.email || '-')),
      h('div', null, h('small', null, 'WhatsApp'), hp ? h('a', { href: hp, target: '_blank', rel: 'noopener' }, x.no_wa) : h('b', null, '-')),
      h('div', null, h('small', null, 'Mendaftar'), h('b', null, tglId(x.dibuat))),
      h('div', null, h('small', null, 'Pilihan'), h('b', null, x.jenjang ? x.jenjang + ' · ' + x.program : 'Belum memilih')))),
    h('div', { class: 'panel' }, h('h3', null, 'Status seleksi'),
      h('div', { class: 'kisi-status' },
        h('div', null, pilih('status_bayar', 'bayar', '03 · Pembayaran registrasi'), h('div', { class: 'medan' }, tombolBerkas(x.bukti_bayar, '📄 Lihat bukti bayar'))),
        pilih('tes_awal', 'tes', '08 · Tes tahap awal'),
        h('div', null, pilih('tes_akhir', 'tes', '09 · Tes tahap akhir'), h('div', { class: 'medan' }, tombolBerkas(x.surat_sehat, '📄 Lihat surat kesehatan'))),
        pilih('kelulusan', 'kelulusan', '10 · Pengumuman kelulusan', 'Hasil ini langsung tampil di dashboard calon santri.')),
      h('div', { class: 'medan' }, h('label', null, 'Pesan untuk calon santri (tampil di dashboard-nya)'),
        h('textarea', { value: ubah.pesan_panitia, placeholder: 'Contoh: Bukti transfer kurang jelas, mohon unggah ulang.', oninput: e => { ubah.pesan_panitia = e.target.value; tandaiKotor(); } })),
      h('div', { class: 'aksi-simpan' }, btn)),
    nilaiPanel,
    h('div', { class: 'panel' }, h('h3', null, '05 · Biodata ', x.biodata_lengkap ? '✅' : '(belum lengkap)'), ...biodata),
    h('div', { class: 'panel' }, h('h3', null, '06 · Formulir wawancara ', x.wawancara_lengkap ? '✅' : '(belum lengkap)'),
      waw.length ? h('dl', { class: 'data-ppdb tanya' }, waw.flatMap(([q, a]) => [h('dt', null, q), h('dd', null, a || '-')])) : h('p', { class: 'ket' }, 'Belum diisi.'),
      h('p', { class: 'ket' }, '07 · Join grup WhatsApp: ', x.gabung_grup ? 'sudah bergabung ✅' : 'belum')),
    h('div', { class: 'panel' }, h('h3', null, 'Hapus data'), h('p', { class: 'ket' }, 'Gunakan hanya untuk data ganda atau pendaftaran yang dibatalkan.'), hapus));
  if (keNilai) { const el = document.getElementById('panel-nilai'); if (el) { el.scrollIntoView({ block: 'start' }); const i = el.querySelector('input'); if (i) i.focus({ preventScroll: true }); } }
}

/* ---------- Nilai tes & rekap kelulusan PPDB (panitia) ---------- */
const PESAN_NILAI_BELUM = 'Fitur nilai tes belum dipasang di database. Jalankan ulang file supabase/ppdb-online.sql (versi terbaru) di Supabase → SQL Editor. File itu aman dijalankan ulang.';
const angkaId = (v, d = 1) => (v == null || v === '' || isNaN(v)) ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d });
const maksKomponen = (k) => Number(k.maks) > 0 ? Number(k.maks) : 100;
const bobotKomponen = (k) => (k.bobot === undefined || k.bobot === null || k.bobot === '' || isNaN(Number(k.bobot))) ? 1 : Math.max(0, Number(k.bobot));
const adaNilai = (v) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));
function bacaSesi(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
function ingatUrutan(baris, asal) { try { sessionStorage.setItem('urutan-ppdb', JSON.stringify(baris.map(x => x.id))); sessionStorage.setItem('asal-ppdb', asal); } catch (e) { /* abaikan */ } }
function tabPpdb(aktif) {
  return h('nav', { class: 'tab-ppdb' },
    h('a', { href: '#/pendaftar', class: aktif === 'daftar' ? 'aktif' : null }, '🧾 Daftar pendaftar'),
    h('a', { href: '#/pendaftar/nilai', class: aktif === 'nilai' ? 'aktif' : null }, '📊 Rekap nilai & kelulusan'));
}
// Nilai akhir = rata-rata (berbobot) semua komponen yang sudah diisi, diubah ke skala 0–100
function hitungNilai(komp, nilai) {
  nilai = nilai || {};
  let jumlah = 0, bobot = 0, terisi = 0, dihitung = 0, dihitungTerisi = 0;
  for (const k of komp) {
    const ada = adaNilai(nilai[k.kode]);
    if (ada) terisi++;
    const w = bobotKomponen(k);
    if (!w) continue;
    dihitung++;
    if (!ada) continue;
    dihitungTerisi++;
    jumlah += Math.min(100, Math.max(0, Number(nilai[k.kode]) / maksKomponen(k) * 100)) * w; bobot += w;
  }
  return { akhir: bobot ? jumlah / bobot : null, terisi, total: komp.length, lengkap: dihitung > 0 && dihitungTerisi === dihitung };
}
async function muatPenilaian() {
  const { data, error } = await sb.from('ppdb_penilaian').select('*').eq('id', 1).maybeSingle();
  if (error) return { error };
  return { komponen: data ? (Array.isArray(data.komponen) ? data.komponen : []) : salin(window.PPDB_KOMPONEN_AWAL || []),
    batas: data && data.batas_lulus != null && data.batas_lulus !== '' ? Number(data.batas_lulus) : null };
}
function teksIsian(k) {
  const jml = k.jenis === 'Jumlah';
  return { contoh: jml ? 'Jumlah ' + (k.satuan || '') + ' dihafalkan' : 'Nilai ' + (k.nama || ''),
    ket: k.keterangan || (jml ? 'dari ' + maksKomponen(k) + ' ' + (k.satuan || '') : (maksKomponen(k) !== 100 ? 'maks. ' + maksKomponen(k) : '')) };
}

async function navigasiPendaftar(id, keNilai) {
  let urutan = null;
  try { urutan = JSON.parse(bacaSesi('urutan-ppdb') || 'null'); } catch (e) { urutan = null; }
  if (!Array.isArray(urutan) || !urutan.includes(id)) {
    const { data } = await sb.from('pendaftar').select('id').order('dibuat', { ascending: true });
    urutan = (data || []).map(r => r.id);
  }
  const i = urutan.indexOf(id);
  if (i < 0 || urutan.length < 2) return null;
  const ke = (j) => '#/pendaftar/' + urutan[j] + (keNilai ? '/nilai' : '');
  return h('div', { class: 'geser-pendaftar' },
    i > 0 ? h('a', { href: ke(i - 1) }, '‹ Sebelumnya') : h('span', null, '‹ Sebelumnya'),
    h('small', null, (i + 1) + ' dari ' + urutan.length),
    i < urutan.length - 1 ? h('a', { href: ke(i + 1), 'data-berikut': urutan[i + 1] }, 'Berikutnya ›') : h('span', null, 'Berikutnya ›'));
}

async function panelNilai(x) {
  const box = h('div', { class: 'panel', id: 'panel-nilai' }, h('h3', null, '📝 Nilai tes'));
  const [pn, nl] = await Promise.all([muatPenilaian(), sb.from('pendaftar_nilai').select('*').eq('id', x.id).maybeSingle()]);
  const err = pn.error || nl.error;
  if (err) { box.append(h('div', { class: 'pesan ' + (tabelBelumAda(err) ? 'peringatan' : 'galat') }, tabelBelumAda(err) ? PESAN_NILAI_BELUM : pesanGalat(err))); return box; }
  const komp = pn.komponen;
  if (!komp.length) { box.append(h('p', { class: 'ket' }, 'Belum ada komponen nilai. Atur dulu di ', h('a', { href: '#/pendaftar/nilai' }, 'Rekap nilai → Pengaturan nilai'), '.')); return box; }
  const nilai = salin((nl.data && nl.data.nilai) || {}), catatan = salin((nl.data && nl.data.catatan) || {});
  const akhir = h('div', { class: 'nilai-akhir' });
  const hitungUlang = () => {
    const r = hitungNilai(komp, nilai);
    let ket = r.terisi + ' dari ' + r.total + ' komponen terisi';
    if (pn.batas != null && r.akhir != null) ket += r.akhir >= pn.batas ? ' · memenuhi batas lulus (' + angkaId(pn.batas) + ')' : ' · di bawah batas lulus (' + angkaId(pn.batas) + ')';
    akhir.className = 'nilai-akhir' + (pn.batas != null && r.lengkap ? (r.akhir >= pn.batas ? ' lulus' : ' kurang') : '');
    akhir.replaceChildren(h('span', null, 'Nilai akhir'), h('b', null, angkaId(r.akhir)), h('small', null, ket));
  };
  const form = h('div', { class: 'form-nilai' });
  komp.forEach(k => {
    const t = teksIsian(k), maks = maksKomponen(k);
    const inp = h('input', { type: 'number', min: 0, max: maks, step: 'any', inputmode: 'decimal', placeholder: t.contoh, value: adaNilai(nilai[k.kode]) ? nilai[k.kode] : '',
      'aria-label': k.nama, class: k.jenis === 'Jumlah' ? 'pendek' : null });
    inp.addEventListener('input', () => {
      const v = inp.value.trim();
      if (v === '') delete nilai[k.kode]; else nilai[k.kode] = Number(v);
      inp.classList.toggle('salah', v !== '' && (Number(v) < 0 || Number(v) > maks));
      tandaiKotor(); hitungUlang();
    });
    const sel = h('div', { class: 'isian-nilai' }, h('div', { class: 'baris-isian' }, inp, t.ket ? h('span', { class: 'ket-nilai' }, t.ket) : null));
    if (k.catatan) sel.append(h('textarea', { rows: 3, placeholder: 'Catatan nilai ' + (k.nama || ''), value: catatan[k.kode] || '',
      oninput: e => { catatan[k.kode] = e.target.value; tandaiKotor(); } }));
    form.append(h('label', { class: 'label-nilai' }, k.nama || '(tanpa nama)'), sel);
  });
  hitungUlang();
  const simpan = async (btn, lanjut) => {
    const salah = komp.find(k => adaNilai(nilai[k.kode]) && (Number(nilai[k.kode]) < 0 || Number(nilai[k.kode]) > maksKomponen(k)));
    if (salah) return toast('Nilai ' + salah.nama + ' harus antara 0 dan ' + maksKomponen(salah) + '.', true);
    const cat = {};
    Object.entries(catatan).forEach(([kk, v]) => { if (String(v || '').trim()) cat[kk] = String(v).trim(); });
    const teks = btn.textContent;
    sibuk(btn, true, 'Menyimpan…');
    try { await pastikanSesi(); } catch (e) { sibuk(btn, false, teks); return toast('Gagal menyimpan: ' + pesanGalat(e), true); }
    const { data, error } = await sb.from('pendaftar_nilai').upsert({ id: x.id, nilai, catatan: cat, penilai: profil.nama || profil.email || '', diubah: new Date().toISOString() }).select();
    sibuk(btn, false, teks);
    if (error || !data || !data.length) return toast('Gagal menyimpan nilai: ' + (error ? pesanGalat(error) : 'tidak ada akses'), true);
    kotor = false;
    toast('Nilai ' + (x.nama || '') + ' disimpan.');
    if (lanjut) {
      const a = document.querySelector('.geser-pendaftar a[data-berikut]');
      if (a) location.hash = '#/pendaftar/' + a.dataset.berikut + '/nilai';
      else toast('Nilai disimpan. Ini pendaftar terakhir di daftar.');
    }
  };
  const btnSimpan = h('button', { class: 'btn btn-emas', type: 'button', onclick: () => simpan(btnSimpan, false) }, '💾 Simpan nilai');
  const btnLanjut = h('button', { class: 'btn btn-hijau', type: 'button', onclick: () => simpan(btnLanjut, true) }, 'Simpan & lanjut ke pendaftar berikutnya ›');
  const info = nl.data && nl.data.penilai ? h('small', { class: 'ket' }, 'Terakhir diisi oleh ' + nl.data.penilai + ', ' + new Date(nl.data.diubah).toLocaleString('id-ID')) : null;
  box.append(h('p', { class: 'ket' }, 'Nilai hanya terlihat oleh panitia. Kosongkan isian yang belum dinilai.'), form, akhir,
    h('div', { class: 'aksi-simpan' }, btnSimpan, btnLanjut, info));
  return box;
}

const F_KOMPONEN = { name: 'komponen', label: 'Komponen nilai (urutannya = urutan isian di formulir nilai)', type: 'object', list: true, fields: [
  { name: 'nama', label: 'Nama komponen', type: 'string', description: 'Contoh: Sholat, Tajwid, Tahfizh, Akademik' },
  { name: 'jenis', label: 'Jenis isian', type: 'select', options: ['Nilai', 'Jumlah'], default: 'Nilai',
    description: 'Nilai = angka 0 sampai nilai maksimal. Jumlah = hitungan, misalnya jumlah ayat yang dihafal.' },
  { name: 'maks', label: 'Nilai / jumlah maksimal', type: 'number', default: 100, description: 'Contoh: 100 untuk nilai, 13 untuk jumlah ayat.' },
  { name: 'satuan', label: 'Satuan (untuk jenis Jumlah)', type: 'string', description: 'Contoh: ayat' },
  { name: 'keterangan', label: 'Keterangan di samping isian', type: 'string', description: "Contoh: Dari 13 ayat (QS. Al-Jumu'ah ayat 1-8)" },
  { name: 'catatan', label: 'Tambahkan kotak catatan untuk komponen ini', type: 'boolean' },
  { name: 'bobot', label: 'Bobot dalam nilai akhir', type: 'number', default: 1, description: '1 = dihitung biasa, 2 = dihitung dua kali lipat, 0 = tidak ikut dihitung dalam nilai akhir.' },
] };

async function halamanRekapNilai() {
  const judul = '📊 Rekap Nilai & Kelulusan';
  kerangka(judul, 'Memuat…');
  const awal0 = location.hash;
  const [rp, rn, pn] = await Promise.all([
    sb.from('pendaftar').select('id, nomor, nama, email, jenjang, program, status_bayar, wawancara_lengkap, tes_awal, tes_akhir, kelulusan, dibuat').order('dibuat', { ascending: true }),
    sb.from('pendaftar_nilai').select('*'),
    muatPenilaian()]);
  if (location.hash !== awal0) return;
  const galat = rp.error || rn.error || pn.error;
  if (galat) {
    const belum = tabelBelumAda(galat);
    return kerangka(judul, null, tabPpdb('nilai'), h('div', { class: 'pesan ' + (belum ? 'peringatan' : 'galat') }, belum ? (rp.error ? PESAN_BELUM_PASANG : PESAN_NILAI_BELUM) : pesanGalat(galat)));
  }
  let komp = pn.komponen, batas = pn.batas;
  const petaNilai = new Map((rn.data || []).map(r => [r.id, r]));
  const semua = (rp.data || []).map(x => Object.assign(x, { _n: petaNilai.get(x.id) || null }));
  const hitungSemua = () => semua.forEach(x => { x._r = hitungNilai(komp, x._n && x._n.nilai); });
  hitungSemua();

  // ----- Pengaturan nilai (komponen & batas lulus) -----
  const cfg = { komponen: salin(komp) };
  const inBatas = h('input', { type: 'number', min: 0, max: 100, step: 'any', value: batas ?? '', placeholder: 'Contoh: 70', style: 'max-width:160px' });
  const btnCfg = h('button', { class: 'btn btn-emas', type: 'button' }, '💾 Simpan pengaturan nilai');
  const atur = h('details', { class: 'panel atur-nilai' }, h('summary', null, '⚙️ Pengaturan nilai: komponen & batas lulus'),
    h('p', { class: 'ket' }, 'Tambah, hapus, atau ubah urutan komponen nilai. Nilai akhir = rata-rata semua komponen (dihitung dalam skala 0–100 sesuai bobotnya). Nilai yang sudah diisi tidak hilang jika nama komponen diubah.'),
    medan(F_KOMPONEN, cfg, 'ppdb'),
    h('div', { class: 'medan' }, h('label', null, 'Batas lulus (nilai akhir minimal, 0–100)'), inBatas,
      h('div', { class: 'ket' }, 'Baris yang nilainya mencapai batas ini ditandai hijau dan bisa diluluskan sekaligus. Kosongkan jika belum ditentukan.')),
    h('div', { class: 'aksi-simpan aksi-biasa' }, btnCfg));
  if (!komp.length || batas == null) atur.open = true;
  atur.addEventListener('input', tandaiKotor);
  btnCfg.addEventListener('click', async () => {
    const baru = cfg.komponen.filter(k => String(k.nama || '').trim());
    const dipakai = new Set(baru.filter(k => k.kode).map(k => k.kode));
    baru.forEach(k => {
      k.nama = String(k.nama).trim();
      if (!k.jenis) k.jenis = 'Nilai';
      if (!(Number(k.maks) > 0)) k.maks = k.jenis === 'Jumlah' ? 10 : 100;
      if (!k.kode) { const dasar = slugify(k.nama).replace(/-/g, '_') || 'komponen'; let kd = dasar, n = 2; while (dipakai.has(kd)) kd = dasar + '_' + n++; k.kode = kd; dipakai.add(kd); }
    });
    const b = inBatas.value.trim() === '' ? null : Number(inBatas.value);
    if (b != null && (isNaN(b) || b < 0 || b > 100)) return toast('Batas lulus harus angka 0 sampai 100.', true);
    sibuk(btnCfg, true, 'Menyimpan…');
    const { data, error } = await sb.from('ppdb_penilaian').upsert({ id: 1, komponen: baru, batas_lulus: b, diubah: new Date().toISOString() }).select();
    sibuk(btnCfg, false, '💾 Simpan pengaturan nilai');
    if (error || !data || !data.length) return toast('Gagal menyimpan: ' + (error ? pesanGalat(error) : 'tidak ada akses'), true);
    kotor = false; komp = salin(baru); batas = b; cfg.komponen.splice(0, cfg.komponen.length, ...salin(baru));
    hitungSemua(); gambar();
    toast('Pengaturan nilai disimpan.');
  });

  // ----- Saringan & tabel -----
  const program = [...new Set(semua.map(x => x.program).filter(Boolean))];
  const pilihJ = h('select', null, h('option', { value: '' }, 'Semua jenjang'), h('option', { value: 'SMP' }, 'SMP'), h('option', { value: 'SMA' }, 'SMA'));
  const pilihP = h('select', null, h('option', { value: '' }, 'Semua program'), program.map(p => h('option', { value: p }, p)));
  const SARING = {
    semua: ['Semua pendaftar', () => true],
    dinilai: ['Sudah dinilai lengkap', x => x._r.lengkap],
    belum: ['Belum dinilai / belum lengkap', x => !x._r.lengkap],
    memenuhi: ['Memenuhi batas lulus', x => batas != null && x._r.lengkap && x._r.akhir >= batas],
    kurang: ['Di bawah batas lulus', x => batas != null && x._r.lengkap && x._r.akhir < batas],
    lulus: ['Sudah dinyatakan LULUS', x => x.kelulusan === 'lulus'],
  };
  const pilihS = h('select', null, Object.entries(SARING).map(([k, [t]]) => h('option', { value: k }, t)));
  const cari = h('input', { type: 'search', placeholder: 'Cari nama atau nomor…' });
  let urut = { kunci: 'akhir', turun: true }, tersaring = [];
  const ringkas = h('div', { class: 'ringkas-ppdb' });
  const massal = h('div', { class: 'massal-ppdb' });
  const thead = h('thead'), tbody = h('tbody');

  const nilaiUrut = (x, kunci) => {
    if (kunci === 'akhir') return x._r.akhir;
    if (kunci === 'nama') return String(x.nama || '').toLowerCase();
    if (kunci === 'nomor') return x.nomor || '';
    if (kunci === 'tes_awal' || kunci === 'kelulusan') return x[kunci] || '';
    if (kunci.startsWith('k:')) { const v = x._n && x._n.nilai ? x._n.nilai[kunci.slice(2)] : undefined; return adaNilai(v) ? Number(v) : null; }
    return '';
  };
  const SINGKAT = { tes: { belum: 'Belum', lulus: 'Lulus', tidak_lulus: 'Tidak lulus' }, kelulusan: { belum: 'Belum', lulus: 'LULUS', tidak_lulus: 'Tidak lulus', cadangan: 'Cadangan' } };
  const pilihCepat = (x, kolom, jenis) => {
    const sel = h('select', { class: 'pilih-cepat st-' + x[kolom], 'aria-label': (jenis === 'tes' ? 'Tes awal ' : 'Kelulusan ') + (x.nama || ''), onclick: e => e.stopPropagation() },
      Object.entries(SINGKAT[jenis]).map(([k, t]) => h('option', { value: k, selected: x[kolom] === k }, t)));
    sel.addEventListener('change', async () => {
      const lama = x[kolom], baru = sel.value;
      if (kolom === 'kelulusan' && baru !== 'belum' && !confirm('Umumkan "' + ST().kelulusan[baru] + '" untuk ' + (x.nama || x.email) + '? Hasil ini langsung tampil di dashboard calon santri.')) { sel.value = lama; return; }
      sel.disabled = true;
      const { data, error } = await sb.from('pendaftar').update({ [kolom]: baru }).eq('id', x.id).select('id');
      sel.disabled = false;
      if (error || !data || !data.length) { sel.value = lama; return toast('Gagal menyimpan: ' + (error ? pesanGalat(error) : 'tidak ada akses'), true); }
      x[kolom] = baru; sel.className = 'pilih-cepat st-' + baru;
      toast((kolom === 'kelulusan' ? 'Kelulusan ' : 'Tes awal ') + (x.nama || '') + ': ' + ST()[jenis][baru]);
      gambarRingkas(); gambarMassal();
    });
    return sel;
  };
  function gambarRingkas() {
    const dinilai = semua.filter(x => x._r.lengkap);
    const rata = dinilai.length ? dinilai.reduce((a, x) => a + x._r.akhir, 0) / dinilai.length : null;
    const tertinggi = dinilai.length ? Math.max(...dinilai.map(x => x._r.akhir)) : null;
    ringkas.replaceChildren(...[
      ['Pendaftar', semua.length], ['Sudah dinilai lengkap', dinilai.length], ['Rata-rata nilai akhir', angkaId(rata)], ['Nilai tertinggi', angkaId(tertinggi)],
      ['Memenuhi batas lulus', batas == null ? '–' : dinilai.filter(x => x._r.akhir >= batas).length], ['Dinyatakan LULUS', semua.filter(x => x.kelulusan === 'lulus').length],
    ].map(([t, v]) => h('div', null, h('b', null, v), h('small', null, t))));
  }
  function gambarMassal() {
    if (batas == null) { massal.replaceChildren(h('span', null, 'Isi ', h('b', null, 'Batas lulus'), ' di Pengaturan nilai agar santri yang memenuhi batas bisa diluluskan sekaligus.')); return; }
    const lolos = tersaring.filter(x => x._r.lengkap && x._r.akhir >= batas);
    const tombol = (kolom, teks) => {
      const calon = lolos.filter(x => x[kolom] === 'belum');
      return h('button', { class: 'btn btn-hijau btn-kecil', type: 'button', disabled: !calon.length, onclick: () => luluskan(calon, kolom, teks) }, teks + ' (' + calon.length + ')');
    };
    massal.replaceChildren(h('span', null, h('b', null, lolos.length), ' santri di tabel ini nilainya lengkap dan mencapai batas lulus ', h('b', null, angkaId(batas)), '.'),
      tombol('tes_awal', '✓ Luluskan Tes Awal'), tombol('kelulusan', '✓ Umumkan LULUS'));
  }
  async function luluskan(calon, kolom, teks) {
    const daftarNama = calon.slice(0, 12).map(x => '• ' + (x.nama || x.email) + ' (' + angkaId(x._r.akhir) + ')').join('\n') + (calon.length > 12 ? '\n• …dan ' + (calon.length - 12) + ' lainnya' : '');
    if (!confirm(teks.replace('✓ ', '') + ' untuk ' + calon.length + ' santri berikut?\n\n' + daftarNama + (kolom === 'kelulusan' ? '\n\nHasil LULUS langsung tampil di dashboard calon santri.' : ''))) return;
    const { data, error } = await sb.from('pendaftar').update({ [kolom]: 'lulus' }).in('id', calon.map(x => x.id)).select('id');
    if (error) return toast('Gagal menyimpan: ' + pesanGalat(error), true);
    const ok = new Set((data || []).map(r => r.id));
    calon.forEach(x => { if (ok.has(x.id)) x[kolom] = 'lulus'; });
    toast(ok.size + ' santri diperbarui: ' + (kolom === 'kelulusan' ? 'LULUS.' : 'lulus tes awal.'));
    gambar();
  }
  function gambar() {
    const q = cari.value.trim().toLowerCase();
    tersaring = semua.filter(SARING[pilihS.value][1]).filter(x => !pilihJ.value || x.jenjang === pilihJ.value).filter(x => !pilihP.value || x.program === pilihP.value)
      .filter(x => !q || [x.nama, x.nomor, x.email].some(v => String(v || '').toLowerCase().includes(q)));
    // Peringkat menurut nilai akhir, hanya yang nilainya lengkap (nilai sama = peringkat sama)
    const berperingkat = tersaring.filter(x => x._r.lengkap).sort((a, b) => b._r.akhir - a._r.akhir);
    const peringkat = new Map(); berperingkat.forEach((x, i) => peringkat.set(x.id, i && Math.abs(x._r.akhir - berperingkat[i - 1]._r.akhir) < 1e-9 ? peringkat.get(berperingkat[i - 1].id) : i + 1));
    const arah = urut.turun ? -1 : 1;
    tersaring.sort((a, b) => {
      const va = nilaiUrut(a, urut.kunci), vb = nilaiUrut(b, urut.kunci);
      if (va === vb) return String(a.nomor).localeCompare(String(b.nomor));
      if (va == null) return 1; if (vb == null) return -1;
      return (va > vb ? 1 : -1) * arah;
    });
    ingatUrutan(tersaring, '#/pendaftar/nilai');
    const kolom = [['#', null], ['Nama', 'nama'], ...komp.map(k => [k.nama + (k.jenis === 'Jumlah' ? ' (' + (k.satuan || 'jumlah') + ')' : ''), 'k:' + k.kode]), ['Nilai akhir', 'akhir'], ['Tes awal', 'tes_awal'], ['Kelulusan', 'kelulusan'], ['', null]];
    thead.replaceChildren(h('tr', null, kolom.map(([t, kunci]) => !kunci ? h('th', null, t) :
      h('th', { class: 'bisa-urut' + (urut.kunci === kunci ? ' aktif' : ''), title: 'Klik untuk mengurutkan', onclick: () => {
        if (urut.kunci === kunci) urut.turun = !urut.turun; else urut = { kunci, turun: kunci === 'akhir' || kunci.startsWith('k:') };
        gambar();
      } }, t, urut.kunci === kunci ? (urut.turun ? ' ▼' : ' ▲') : ''))));
    const kosongKolom = kolom.length;
    tbody.replaceChildren(...(tersaring.length ? tersaring.map(x => {
      const r = x._r, n = (x._n && x._n.nilai) || {}, c = (x._n && x._n.catatan) || {};
      const kelas = r.lengkap ? (batas == null ? 'lengkap' : r.akhir >= batas ? 'memenuhi' : 'kurang') : (r.terisi ? 'sebagian' : 'kosong');
      return h('tr', { class: 'baris-klik ' + kelas, onclick: () => { location.hash = '#/pendaftar/' + x.id + '/nilai'; } },
        h('td', { class: 'peringkat' }, peringkat.get(x.id) || '–'),
        h('td', null, h('b', null, x.nama || '(tanpa nama)'), h('br'), h('small', null, (x.nomor || '-') + (x.jenjang ? ' · ' + x.jenjang + ' · ' + x.program : ''))),
        ...komp.map(k => h('td', { class: 'angka', title: c[k.kode] ? 'Catatan: ' + c[k.kode] : null },
          adaNilai(n[k.kode]) ? angkaId(n[k.kode], 2) + (k.jenis === 'Jumlah' ? '/' + maksKomponen(k) : '') : h('span', { class: 'kosong-nilai' }, '–'), c[k.kode] ? ' 📝' : null)),
        h('td', { class: 'angka akhir' }, h('b', null, angkaId(r.akhir)), r.terisi && !r.lengkap ? h('small', { class: 'belum-lengkap' }, ' belum lengkap') : null),
        h('td', null, pilihCepat(x, 'tes_awal', 'tes')),
        h('td', null, pilihCepat(x, 'kelulusan', 'kelulusan')),
        h('td', null, h('a', { href: '#/pendaftar/' + x.id + '/nilai', class: 'btn btn-garis btn-kecil', onclick: e => e.stopPropagation(), title: r.terisi ? 'Ubah nilai' : 'Isi nilai', 'aria-label': (r.terisi ? 'Ubah nilai ' : 'Isi nilai ') + (x.nama || '') }, '✏️')));
    }) : [h('tr', null, h('td', { colspan: kosongKolom, style: 'text-align:center;color:var(--abu);padding:24px' }, 'Tidak ada pendaftar.'))]));
    gambarRingkas(); gambarMassal();
  }
  [pilihJ, pilihP, pilihS].forEach(el => el.addEventListener('change', gambar));
  cari.addEventListener('input', gambar);
  gambar();
  const unduh = h('button', { class: 'btn btn-garis btn-kecil', type: 'button', onclick: () => unduhCsvNilai(tersaring, komp, batas) }, '⬇️ Unduh rekap (Excel/CSV)');
  const cetak = h('button', { class: 'btn btn-garis btn-kecil', type: 'button', onclick: () => window.print() }, '🖨️ Cetak');
  kerangka(judul, 'Klik baris untuk mengisi atau mengubah nilai. Klik judul kolom untuk mengurutkan. Kelulusan bisa diubah langsung di tabel.',
    tabPpdb('nilai'), ringkas, atur,
    h('div', { class: 'panel' },
      h('div', { class: 'alat-ppdb alat-nilai' }, pilihS, pilihJ, pilihP, cari, h('div', { class: 'tombol-alat' }, unduh, cetak)),
      massal,
      h('div', { class: 'tabel-wrap' }, h('table', { class: 'tabel-ppdb tabel-nilai' }, thead, tbody)),
      h('p', { class: 'ket' }, 'Hijau = nilai lengkap dan mencapai batas lulus. Merah muda = di bawah batas. Peringkat (#) hanya untuk yang nilainya sudah lengkap. 📝 = ada catatan (arahkan kursor untuk membaca).')));
}

function unduhCsvNilai(baris, komp, batas) {
  const kolom = [['Nomor', x => x.nomor], ['Nama', x => x.nama], ['Jenjang', x => x.jenjang], ['Program', x => x.program],
    ...komp.flatMap(k => {
      const isi = [[k.nama + (k.jenis === 'Jumlah' ? ' (dari ' + maksKomponen(k) + ' ' + (k.satuan || '') + ')' : ''), x => { const v = x._n && x._n.nilai ? x._n.nilai[k.kode] : ''; return adaNilai(v) ? angkaId(v, 2) : ''; }]];
      if (k.catatan) isi.push(['Catatan ' + k.nama, x => (x._n && x._n.catatan && x._n.catatan[k.kode]) || '']);
      return isi;
    }),
    ['Nilai akhir', x => x._r.akhir == null ? '' : angkaId(x._r.akhir, 2)], ['Nilai lengkap', x => x._r.lengkap ? 'Ya' : 'Belum'],
    ['Memenuhi batas lulus' + (batas != null ? ' (' + angkaId(batas) + ')' : ''), x => batas == null || !x._r.lengkap ? '' : (x._r.akhir >= batas ? 'Ya' : 'Tidak')],
    ['Tes awal', x => ST().tes[x.tes_awal]], ['Tes akhir', x => ST().tes[x.tes_akhir]], ['Kelulusan', x => ST().kelulusan[x.kelulusan]], ['Penilai', x => (x._n && x._n.penilai) || '']];
  const sel = (v) => { let t = String(v == null ? '' : v).replace(/\r?\n/g, ' '); if (/^[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const csv = [kolom.map(k => sel(k[0])).join(';'), ...baris.map(x => kolom.map(k => sel(k[1](x))).join(';'))].join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })), download: 'rekap-nilai-ppdb-' + new Date().toISOString().slice(0, 10) + '.csv' });
  document.body.append(a); a.click(); a.remove();
}

mulai().catch(e => { console.error(e); app.replaceChildren(layarMasuk(h('div', { class: 'pesan galat' }, 'Terjadi kesalahan: ' + pesanGalat(e)))); });
})();
