/* Formulir biodata PPDB online. Dipakai oleh halaman calon santri (/pendaftaran/)
 * dan panel admin (menu Pendaftar PPDB). Setiap isian: [kunci, label, wajib, jenis, contoh]. */
window.PPDB_BIODATA = [
  { judul: 'Data Calon Santri', isian: [
    ['nama_lengkap', 'Nama lengkap (sesuai akta kelahiran)', true],
    ['nama_panggilan', 'Nama panggilan', false],
    ['nisn', 'NISN', false, 'angka', '10 digit'],
    ['nik', 'NIK (sesuai Kartu Keluarga)', true, 'angka', '16 digit'],
    ['tempat_lahir', 'Tempat lahir', true],
    ['tanggal_lahir', 'Tanggal lahir', true, 'date'],
    ['anak_ke', 'Anak ke-', false, 'number'],
    ['jumlah_saudara', 'Jumlah saudara kandung', false, 'number'],
    ['asal_sekolah', 'Asal sekolah (SD/MI atau SMP/MTs)', true],
    ['alamat', 'Alamat lengkap', true, 'textarea'],
    ['hafalan', 'Jumlah hafalan Al-Qur\'an', false, 'text', 'contoh: 3 juz'],
    ['riwayat_penyakit', 'Riwayat penyakit (jika ada)', false, 'textarea'],
  ] },
  { judul: 'Data Ayah', isian: [
    ['nama_ayah', 'Nama ayah', true],
    ['pekerjaan_ayah', 'Pekerjaan ayah', false],
    ['hp_ayah', 'No. HP/WhatsApp ayah', false, 'tel'],
  ] },
  { judul: 'Data Ibu', isian: [
    ['nama_ibu', 'Nama ibu', true],
    ['pekerjaan_ibu', 'Pekerjaan ibu', false],
    ['hp_ibu', 'No. HP/WhatsApp ibu', true, 'tel'],
  ] },
  { judul: 'Data Wali (isi jika calon santri tinggal bersama wali)', isian: [
    ['nama_wali', 'Nama wali', false],
    ['hubungan_wali', 'Hubungan dengan calon santri', false],
    ['hp_wali', 'No. HP/WhatsApp wali', false, 'tel'],
  ] },
];

window.PPDB_STATUS = {
  bayar: { belum: 'Belum mengunggah', menunggu: 'Menunggu pemeriksaan', diterima: 'Diterima', ditolak: 'Ditolak' },
  tes: { belum: 'Belum ada hasil', lulus: 'Lulus', tidak_lulus: 'Tidak lulus' },
  kelulusan: { belum: 'Belum diumumkan', lulus: 'LULUS', tidak_lulus: 'Tidak lulus', cadangan: 'Cadangan' },
};

// Komponen nilai tes bawaan (dipakai jika pengaturan nilai belum pernah disimpan). Sama dengan isi awal di supabase/ppdb-online.sql.
window.PPDB_KOMPONEN_AWAL = [
  { kode: 'sholat', nama: 'Sholat', jenis: 'Nilai', maks: 100, satuan: '', keterangan: '', catatan: false, bobot: 1, berlaku: 'Semua jenjang' },
  { kode: 'tajwid', nama: 'Tajwid', jenis: 'Nilai', maks: 100, satuan: '', keterangan: '', catatan: true, bobot: 1, berlaku: 'Semua jenjang' },
  { kode: 'hafalan', nama: 'Pencapaian Hafalan', jenis: 'Jumlah', maks: 13, satuan: 'ayat', materi: "QS. Al-Jumu'ah ayat 1-8", keterangan: '', catatan: false, bobot: 1, berlaku: 'Semua jenjang' },
  { kode: 'tahfizh', nama: 'Tahfizh', jenis: 'Nilai', maks: 100, satuan: '', keterangan: '', catatan: false, bobot: 1, berlaku: 'Semua jenjang' },
  { kode: 'akademik', nama: 'Akademik', jenis: 'Nilai', maks: 100, satuan: '', keterangan: '', catatan: false, bobot: 1, berlaku: 'Semua jenjang' },
];

// Berkas syarat lulus Tes Tahap Akhir (langkah 09) bawaan, dipakai jika pengaturan belum pernah disimpan.
// Sama dengan isi awal di supabase/ppdb-online.sql (bagian 8). Jenis "Pembayaran": sisa yang belum dibayar menjadi tagihan.
window.PPDB_SYARAT_AWAL = [
  { kode: 'kesehatan', nama: 'Surat Hasil Pemeriksaan Kesehatan', jenis: 'Berkas', wajib: true, format: '',
    keterangan: 'Unduh format surat, minta dokter/puskesmas mengisinya, lalu unggah foto atau scan surat yang sudah ditandatangani.' },
  { kode: 'bayar_administrasi', nama: 'Bukti Bayar Administrasi', jenis: 'Pembayaran', wajib: true, format: '', biaya_smp: 0, biaya_sma: 0,
    keterangan: 'Transfer biaya administrasi ke rekening pondok, lalu unggah bukti transfer. Jika belum bisa membayar penuh, sisanya dicatat sebagai tagihan.' },
  { kode: 'pernyataan', nama: 'Surat Pernyataan Menaati Peraturan Pondok', jenis: 'Berkas', wajib: true, format: '',
    keterangan: 'Unduh format surat pernyataan, cetak, isi, dan tanda tangani, lalu unggah foto atau scan-nya.' },
];
window.PPDB_STATUS.berkas = { belum: 'Belum diunggah', menunggu: 'Menunggu pemeriksaan', diterima: 'Diterima', ditolak: 'Ditolak' };
window.PPDB_STATUS.tagihan = { belum: 'Belum dibayar', sebagian: 'Belum lunas', lunas: 'Lunas' };
// Daftar berkas yang dipakai: hanya item bernama & berkode; item tanpa "wajib" dianggap wajib
window.PPDB_SYARAT_RAPI = (daftar) => (Array.isArray(daftar) ? daftar : []).filter(i => i && i.kode && String(i.nama || '').trim()).map(i => Object.assign({}, i, { wajib: i.wajib !== false }));
window.PPDB_BIAYA_SYARAT = (item, jenjang) => { const v = Number(jenjang === 'SMA' ? item.biaya_sma : item.biaya_smp); return v > 0 ? v : 0; };
window.PPDB_RUPIAH = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
