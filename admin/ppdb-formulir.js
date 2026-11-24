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
