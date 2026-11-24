// Service worker sederhana untuk aplikasi Darul Marhamah.
// Semua data tetap diambil langsung dari internet (online). Jika tidak ada koneksi,
// halaman "Tidak ada koneksi" ditampilkan. Data Supabase tidak pernah disimpan di cache.
const CACHE = 'dm-aplikasi-v1';
const OFFLINE = new URL('aplikasi/offline.html', self.registration.scope).href;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(OFFLINE, { cache: 'reload' }))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return; // selain halaman: biarkan browser seperti biasa
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
