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
const semuaBagian = () => [window.BAGIAN_BERITA, ...window.SKEMA];

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
    if (isiWeb.length) { samping.append(h('h4', null, 'Isi Website')); isiWeb.forEach(b => samping.append(tautan(b.kunci === 'berita' ? '#/berita' : '#/konten/' + b.kunci, b.ikon, b.label))); }
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
    h('a', { class: 'ubin', href: b.kunci === 'berita' ? '#/berita' : '#/konten/' + b.kunci }, h('span', { class: 'ik' }, b.ikon), h('div', null, h('b', null, b.label), h('small', null, 'Kelola')) ));
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
    if (kosong.length) {
      try {
        const awal = await (await fetch('data-awal.json', { cache: 'no-store' })).json();
        const a = awal && awal[kunci];
        const terisi = kosong.filter(f => a && a[f.name] !== undefined);
        terisi.forEach(f => { data[f.name] = salin(a[f.name]); });
        if (terisi.length) info = h('div', { class: 'pesan info', style: 'margin-bottom:14px' },
          'Isian baru "' + terisi.map(f => f.label).join('", "') + '" sudah diisi sesuai yang tampil di website. Klik Simpan agar tersimpan di panel.');
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
        const judul = () => { const p = (f.fields || []).find(x => x.type === 'string'); return (p && item[p.name]) || '(baru)'; };
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

mulai().catch(e => { console.error(e); app.replaceChildren(layarMasuk(h('div', { class: 'pesan galat' }, 'Terjadi kesalahan: ' + pesanGalat(e)))); });
})();
