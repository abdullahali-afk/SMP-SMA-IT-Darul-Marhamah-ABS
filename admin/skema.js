// Dibuat otomatis dari .pages.yml — daftar bagian yang bisa diedit di panel admin.
window.SKEMA = [
 {
  "kunci": "menu",
  "label": "Menu Website",
  "ikon": "☰",
  "fields": [
   {
    "name": "daftar",
    "label": "Menu utama",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "judul",
      "label": "Judul menu",
      "type": "string"
     },
     {
      "name": "link",
      "label": "Link",
      "type": "string",
      "description": "Contoh /profil.html atau https://..."
     },
     {
      "name": "tombol",
      "label": "Tampil sebagai tombol oranye",
      "type": "boolean"
     },
     {
      "name": "sub",
      "label": "Submenu",
      "type": "object",
      "list": true,
      "fields": [
       {
        "name": "judul",
        "label": "Judul",
        "type": "string"
       },
       {
        "name": "link",
        "label": "Link",
        "type": "string"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "kunci": "beranda",
  "label": "Halaman Depan (Beranda)",
  "ikon": "🏠",
  "fields": [
   {
    "name": "hero",
    "label": "Banner utama (slide)",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "judul_arab",
      "label": "Kalimat Arab (opsional)",
      "type": "string"
     },
     {
      "name": "judul",
      "label": "Judul besar",
      "type": "string"
     },
     {
      "name": "sub",
      "label": "Teks kecil",
      "type": "text"
     },
     {
      "name": "foto",
      "label": "Foto latar (opsional, mendatar)",
      "type": "image"
     },
     {
      "name": "tombol",
      "label": "Tulisan tombol",
      "type": "string"
     },
     {
      "name": "link",
      "label": "Link tombol",
      "type": "string",
      "description": "Contoh /ppdb.html"
     }
    ]
   },
   {
    "name": "tautan",
    "label": "4 kotak tautan di bawah banner",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "ikon",
      "label": "Ikon (emoji)",
      "type": "string"
     },
     {
      "name": "judul",
      "label": "Judul",
      "type": "string"
     },
     {
      "name": "isi",
      "label": "Keterangan",
      "type": "text"
     },
     {
      "name": "link",
      "label": "Link",
      "type": "string",
      "description": "Contoh /profil.html"
     }
    ]
   },
   {
    "name": "foto_visi",
    "label": "Foto di samping Visi & Misi",
    "type": "image"
   },
   {
    "name": "capaian",
    "label": "Capaian",
    "type": "object",
    "fields": [
     {
      "name": "judul",
      "label": "Judul",
      "type": "string"
     },
     {
      "name": "teks",
      "label": "Teks",
      "type": "text"
     }
    ]
   },
   {
    "name": "alasan",
    "label": "Alasan memilih",
    "type": "object",
    "fields": [
     {
      "name": "foto",
      "label": "Foto",
      "type": "image"
     },
     {
      "name": "daftar",
      "label": "Alasan",
      "type": "object",
      "list": true,
      "fields": [
       {
        "name": "judul",
        "label": "Judul",
        "type": "string"
       },
       {
        "name": "isi",
        "label": "Penjelasan",
        "type": "text"
       }
      ]
     }
    ]
   },
   {
    "name": "alumni",
    "label": "Kiprah alumni",
    "type": "object",
    "fields": [
     {
      "name": "judul",
      "label": "Judul",
      "type": "string"
     },
     {
      "name": "teks",
      "label": "Teks",
      "type": "text"
     },
     {
      "name": "link",
      "label": "Link tombol",
      "type": "string"
     }
    ]
   },
   {
    "name": "layanan",
    "label": "Daftar layanan",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "nama",
      "label": "Nama layanan",
      "type": "string"
     },
     {
      "name": "link",
      "label": "Link",
      "type": "string"
     }
    ]
   },
   {
    "name": "call_center",
    "label": "Call center",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "bagian",
      "label": "Bagian",
      "type": "string"
     },
     {
      "name": "nomor",
      "label": "Nomor WhatsApp/telepon",
      "type": "string"
     }
    ]
   },
   {
    "name": "mitra",
    "label": "Mitra / kerja sama (logo)",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "nama",
      "label": "Nama mitra",
      "type": "string"
     },
     {
      "name": "logo",
      "label": "Logo",
      "type": "image"
     }
    ]
   }
  ]
 },
 {
  "kunci": "sekolah",
  "label": "Data Sekolah & Kontak",
  "ikon": "🏫",
  "fields": [
   {
    "name": "nama_singkat",
    "label": "Nama singkat (di menu atas)",
    "type": "string"
   },
   {
    "name": "nama_lengkap",
    "label": "Nama lengkap",
    "type": "string"
   },
   {
    "name": "slogan",
    "label": "Slogan",
    "type": "string"
   },
   {
    "name": "deskripsi",
    "label": "Deskripsi singkat (di halaman depan)",
    "type": "text"
   },
   {
    "name": "whatsapp",
    "label": "Nomor WhatsApp untuk tombol & formulir",
    "type": "string",
    "description": "Format 62..., tanpa + dan tanpa 0 di depan. Contoh 6285211869470"
   },
   {
    "name": "telepon",
    "label": "Nomor telepon (yang ditampilkan)",
    "type": "string"
   },
   {
    "name": "kontak_wa",
    "label": "Kontak person WhatsApp (tampil di website)",
    "type": "object",
    "list": true,
    "description": "Isi nama dan nomor setiap kontak person, misalnya \"Admin SMP\" 0852-1186-9470. Jika lebih dari satu, pengunjung bisa memilih kontak di tombol WhatsApp dan formulir. Jika kosong, nomor WhatsApp utama di atas yang dipakai.",
    "fields": [
     {
      "name": "nama",
      "label": "Nama / bagian",
      "type": "string",
      "description": "Contoh: Admin SMP, Admin SMA, Ustadzah Fulanah"
     },
     {
      "name": "nomor",
      "label": "Nomor WhatsApp",
      "type": "string",
      "description": "Contoh: 0852-1186-9470"
     }
    ]
   },
   {
    "name": "email",
    "label": "Email",
    "type": "string"
   },
   {
    "name": "jam_kantor",
    "label": "Jam kantor",
    "type": "string"
   },
   {
    "name": "yayasan",
    "label": "Nama yayasan",
    "type": "string"
   },
   {
    "name": "tahun_berdiri",
    "label": "Tahun berdiri",
    "type": "string"
   },
   {
    "name": "sejarah",
    "label": "Selayang pandang / sejarah singkat",
    "type": "text"
   },
   {
    "name": "visi",
    "label": "Visi",
    "type": "text"
   },
   {
    "name": "misi",
    "label": "Misi",
    "type": "string",
    "list": true
   },
   {
    "name": "smp",
    "label": "Data SMP",
    "type": "object",
    "fields": [
     {
      "name": "nama",
      "label": "Nama resmi",
      "type": "string"
     },
     {
      "name": "npsn",
      "label": "NPSN",
      "type": "string"
     },
     {
      "name": "alamat",
      "label": "Alamat",
      "type": "string"
     },
     {
      "name": "kepala_sekolah",
      "label": "Kepala sekolah",
      "type": "string"
     },
     {
      "name": "akreditasi",
      "label": "Akreditasi",
      "type": "string"
     },
     {
      "name": "target_hafalan",
      "label": "Target hafalan",
      "type": "string"
     },
     {
      "name": "keterangan",
      "label": "Keterangan singkat",
      "type": "text"
     },
     {
      "name": "peta",
      "label": "Lokasi Google Maps",
      "type": "peta",
      "description": "Buka Google Maps, cari sekolahnya, klik Bagikan lalu Salin link, kemudian tempel di sini. Boleh juga kode Sematkan peta, koordinat, atau alamat."
     }
    ]
   },
   {
    "name": "sma",
    "label": "Data SMA",
    "type": "object",
    "fields": [
     {
      "name": "nama",
      "label": "Nama resmi",
      "type": "string"
     },
     {
      "name": "npsn",
      "label": "NPSN",
      "type": "string"
     },
     {
      "name": "alamat",
      "label": "Alamat",
      "type": "string"
     },
     {
      "name": "kepala_sekolah",
      "label": "Kepala sekolah",
      "type": "string"
     },
     {
      "name": "akreditasi",
      "label": "Akreditasi",
      "type": "string"
     },
     {
      "name": "target_hafalan",
      "label": "Target hafalan",
      "type": "string"
     },
     {
      "name": "keterangan",
      "label": "Keterangan singkat",
      "type": "text"
     },
     {
      "name": "peta",
      "label": "Lokasi Google Maps",
      "type": "peta",
      "description": "Buka Google Maps, cari sekolahnya, klik Bagikan lalu Salin link, kemudian tempel di sini. Boleh juga kode Sematkan peta, koordinat, atau alamat."
     }
    ]
   },
   {
    "name": "statistik",
    "label": "Angka statistik (halaman depan)",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "angka",
      "label": "Angka",
      "type": "string"
     },
     {
      "name": "label",
      "label": "Keterangan",
      "type": "string"
     }
    ]
   },
   {
    "name": "foto_sekolah",
    "label": "Foto gedung sekolah",
    "type": "image"
   },
   {
    "name": "sosmed",
    "label": "Media sosial (link lengkap, kosongkan jika tidak ada)",
    "type": "object",
    "fields": [
     {
      "name": "facebook",
      "label": "Facebook",
      "type": "string"
     },
     {
      "name": "instagram",
      "label": "Instagram",
      "type": "string"
     },
     {
      "name": "youtube",
      "label": "YouTube",
      "type": "string"
     },
     {
      "name": "tiktok",
      "label": "TikTok",
      "type": "string"
     }
    ]
   }
  ]
 },
 {
  "kunci": "program_pendidikan",
  "label": "Program & Kampus",
  "ikon": "🎓",
  "fields": [
   {
    "name": "judul",
    "label": "Judul bagian",
    "type": "string"
   },
   {
    "name": "pengantar",
    "label": "Kalimat pengantar",
    "type": "text"
   },
   {
    "name": "daftar",
    "label": "Program pendidikan",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "nama",
      "label": "Nama singkat program",
      "type": "string",
      "description": "Contoh: Program Tahfizh"
     },
     {
      "name": "nama_lengkap",
      "label": "Nama lengkap program",
      "type": "string"
     },
     {
      "name": "ikon",
      "label": "Ikon (emoji)",
      "type": "string"
     },
     {
      "name": "jenjang",
      "label": "Jenjang di program ini",
      "type": "string",
      "list": true,
      "description": "Contoh: SMP, SMA"
     },
     {
      "name": "kampus",
      "label": "Nama lokasi / kampus",
      "type": "string",
      "description": "Contoh: Kampus Sukamaju"
     },
     {
      "name": "alamat",
      "label": "Alamat kampus",
      "type": "text"
     },
     {
      "name": "peta",
      "label": "Lokasi Google Maps kampus",
      "type": "peta",
      "description": "Tempel link lokasi dari Google Maps (tombol Bagikan → Salin link)."
     },
     {
      "name": "foto",
      "label": "Foto sampul program (opsional)",
      "type": "image"
     },
     {
      "name": "ringkasan",
      "label": "Penjelasan singkat program",
      "type": "text"
     },
     {
      "name": "visi",
      "label": "Visi",
      "type": "text"
     },
     {
      "name": "misi",
      "label": "Misi",
      "type": "string",
      "list": true,
      "description": "Satu baris untuk satu poin misi"
     }
    ],
    "description": "Setiap program punya halaman sendiri di website. Program unggulan, ekstrakurikuler, fasilitas, foto galeri, dan video dipilih programnya di menu masing-masing (isian \"Program\")."
   }
  ]
 },
 {
  "kunci": "ppdb",
  "label": "Info PPDB",
  "ikon": "📝",
  "fields": [
   {
    "name": "tahun_ajaran",
    "label": "Tahun ajaran",
    "type": "string"
   },
   {
    "name": "status",
    "label": "Status pendaftaran",
    "type": "string",
    "description": "Contoh: Pendaftaran dibuka / Pendaftaran ditutup"
   },
   {
    "name": "langkah",
    "label": "Alur pendaftaran (langkah 01, 02, dst.)",
    "type": "object",
    "list": true,
    "description": "Nomor langkah dibuat otomatis sesuai urutan. Gunakan tombol panah untuk mengubah urutan.",
    "fields": [
     {
      "name": "judul",
      "label": "Nama langkah",
      "type": "string"
     },
     {
      "name": "isi",
      "label": "Penjelasan",
      "type": "text"
     },
     {
      "name": "catatan",
      "label": "Catatan (opsional)",
      "type": "text"
     },
     {
      "name": "tombol",
      "label": "Teks tombol (opsional)",
      "type": "string"
     },
     {
      "name": "tautan",
      "label": "Link tombol (opsional)",
      "type": "string",
      "description": "Contoh: #biaya (bagian biaya di halaman ini), /profil.html#visi-misi-program, atau link https://…"
     }
    ]
   },
   {
    "name": "gelombang",
    "label": "Jadwal gelombang",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "nama",
      "label": "Gelombang",
      "type": "string"
     },
     {
      "name": "waktu",
      "label": "Waktu",
      "type": "string"
     }
    ]
   },
   {
    "name": "syarat",
    "label": "Persyaratan",
    "type": "string",
    "list": true
   },
   {
    "name": "biaya",
    "label": "Rincian biaya",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "komponen",
      "label": "Komponen",
      "type": "string"
     },
     {
      "name": "smp",
      "label": "Biaya SMP",
      "type": "string"
     },
     {
      "name": "sma",
      "label": "Biaya SMA",
      "type": "string"
     }
    ]
   },
   {
    "name": "catatan_biaya",
    "label": "Catatan biaya",
    "type": "text"
   },
   {
    "name": "rekening",
    "label": "Rekening pembayaran",
    "type": "string"
   },
   {
    "name": "brosur",
    "label": "Brosur PPDB (PDF/gambar)",
    "type": "file"
   },
   {
    "name": "online",
    "label": "PPDB Online (akun calon santri)",
    "type": "object",
    "fields": [
     {
      "name": "dibuka",
      "label": "Pendaftaran akun calon santri dibuka",
      "type": "boolean"
     },
     {
      "name": "biaya_registrasi",
      "label": "Biaya registrasi PPDB",
      "type": "string",
      "description": "Contoh: Rp 300.000. Jika dikosongkan, dipakai baris \"Pendaftaran\" di Rincian biaya."
     },
     {
      "name": "info_bayar",
      "label": "Petunjuk pembayaran registrasi",
      "type": "text",
      "description": "Nomor rekening diambil dari isian \"Rekening pembayaran\" di atas."
     },
     {
      "name": "info_tes_awal",
      "label": "Informasi Tes/Seleksi Tahap Awal (jadwal & tempat)",
      "type": "text"
     },
     {
      "name": "info_tes_akhir",
      "label": "Informasi Tes Tahap Akhir",
      "type": "text"
     },
     {
      "name": "info_lulus",
      "label": "Pesan untuk calon santri yang LULUS",
      "type": "text"
     },
     {
      "name": "pertanyaan_wawancara",
      "label": "Pertanyaan formulir wawancara",
      "type": "object",
      "list": true,
      "fields": [
       {
        "name": "bagian",
        "label": "Ditujukan untuk",
        "type": "select",
        "options": [
         "Calon santri",
         "Orang tua / wali"
        ]
       },
       {
        "name": "pertanyaan",
        "label": "Pertanyaan",
        "type": "text"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "kunci": "guru",
  "label": "Guru & Staf",
  "ikon": "👩‍🏫",
  "fields": [
   {
    "name": "daftar",
    "label": "Daftar guru & staf",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "nama",
      "label": "Nama",
      "type": "string"
     },
     {
      "name": "jabatan",
      "label": "Jabatan / mata pelajaran",
      "type": "string"
     },
     {
      "name": "kategori",
      "label": "Kategori",
      "type": "select",
      "options": [
       "Guru",
       "Tenaga Kependidikan"
      ]
     },
     {
      "name": "jenjang",
      "label": "Jenjang (tampil di menu Guru SMP / Guru SMA)",
      "type": "select",
      "options": [
       "SMP",
       "SMA",
       "SMP & SMA"
      ],
      "description": "Pilih SMP, SMA, atau SMP & SMA jika mengajar di keduanya. Jika dikosongkan, dilihat dari jabatan (misalnya \"Kepala SMP\"); selain itu tampil di keduanya."
     },
     {
      "name": "foto",
      "label": "Foto",
      "type": "image"
     }
    ]
   }
  ]
 },
 {
  "kunci": "struktur",
  "label": "Struktur Organisasi",
  "ikon": "🗂️",
  "fields": [
   {
    "name": "daftar",
    "label": "Pengurus (paling atas tampil sendiri di puncak)",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "jabatan",
      "label": "Jabatan",
      "type": "string"
     },
     {
      "name": "nama",
      "label": "Nama",
      "type": "string"
     },
     {
      "name": "foto",
      "label": "Foto",
      "type": "image"
     }
    ]
   }
  ]
 },
 {
  "kunci": "galeri",
  "label": "Galeri Foto",
  "ikon": "🖼️",
  "fields": [
   {
    "name": "daftar",
    "label": "Foto",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "judul",
      "label": "Keterangan foto",
      "type": "string"
     },
     {
      "name": "kategori",
      "label": "Kategori",
      "type": "select",
      "options": [
       "kegiatan",
       "prestasi",
       "fasilitas",
       "wisuda"
      ]
     },
     {
      "name": "program",
      "label": "Program",
      "type": "select",
      "options": [
       "Kedua program",
       "Program Tahfizh",
       "Program Takhassus"
      ],
      "description": "Pilih program agar foto ini tampil di bagian Dokumentasi halaman program tersebut. Kosong atau \"Kedua program\" = tampil di kedua program."
     },
     {
      "name": "foto",
      "label": "Foto",
      "type": "image"
     },
     {
      "name": "ikon",
      "label": "Ikon cadangan (jika belum ada foto)",
      "type": "string"
     }
    ]
   }
  ]
 },
 {
  "kunci": "video",
  "label": "Video YouTube",
  "ikon": "▶️",
  "fields": [
   {
    "name": "daftar",
    "label": "Daftar video (video pertama tampil besar di halaman depan)",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "judul",
      "label": "Judul video",
      "type": "string"
     },
     {
      "name": "url",
      "label": "Link YouTube",
      "type": "string",
      "description": "Tempel link video biasa, contoh https://www.youtube.com/watch?v=xxxx atau https://youtu.be/xxxx (bukan link channel)."
     },
     {
      "name": "program",
      "label": "Program",
      "type": "select",
      "options": [
       "Kedua program",
       "Program Tahfizh",
       "Program Takhassus"
      ],
      "description": "Pilih program agar video ini tampil di halaman program tersebut. Kosong atau \"Kedua program\" = tampil di kedua program."
     }
    ]
   }
  ]
 },
 {
  "kunci": "testimoni",
  "label": "Testimoni",
  "ikon": "💬",
  "fields": [
   {
    "name": "daftar",
    "label": "Testimoni",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "nama",
      "label": "Nama",
      "type": "string"
     },
     {
      "name": "kategori",
      "label": "Kelompok",
      "type": "select",
      "options": [
       "Orang Tua",
       "Alumni",
       "Tokoh"
      ]
     },
     {
      "name": "keterangan",
      "label": "Keterangan (wali santriwati / alumni)",
      "type": "string"
     },
     {
      "name": "isi",
      "label": "Isi testimoni",
      "type": "text"
     },
     {
      "name": "foto",
      "label": "Foto",
      "type": "image"
     },
     {
      "name": "video",
      "label": "Link video testimoni (opsional)",
      "type": "video",
      "description": "Tempel link video dari YouTube (termasuk Shorts), Google Drive, Instagram, TikTok, atau Facebook. Video diputar langsung di website."
     }
    ]
   }
  ]
 },
 {
  "kunci": "fasilitas",
  "label": "Fasilitas & Ekstrakurikuler",
  "ikon": "🏛️",
  "fields": [
   {
    "name": "fasilitas",
    "label": "Fasilitas",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "nama",
      "label": "Nama",
      "type": "string"
     },
     {
      "name": "program",
      "label": "Program",
      "type": "select",
      "options": [
       "Kedua program",
       "Program Tahfizh",
       "Program Takhassus"
      ],
      "description": "Pilih program agar item ini tampil di halaman program tersebut. Kosong atau \"Kedua program\" = tampil di halaman kedua program."
     },
     {
      "name": "ikon",
      "label": "Ikon (emoji)",
      "type": "string"
     },
     {
      "name": "foto",
      "label": "Foto",
      "type": "image"
     }
    ],
    "description": "Fasilitas tiap kampus: pilih programnya agar tampil di halaman program yang sesuai."
   },
   {
    "name": "ekstrakurikuler",
    "label": "Ekstrakurikuler",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "nama",
      "label": "Nama",
      "type": "string"
     },
     {
      "name": "program",
      "label": "Program",
      "type": "select",
      "options": [
       "Kedua program",
       "Program Tahfizh",
       "Program Takhassus"
      ],
      "description": "Pilih program agar item ini tampil di halaman program tersebut. Kosong atau \"Kedua program\" = tampil di halaman kedua program."
     },
     {
      "name": "ikon",
      "label": "Ikon (emoji)",
      "type": "string"
     },
     {
      "name": "foto",
      "label": "Foto",
      "type": "image"
     }
    ]
   }
  ]
 },
 {
  "kunci": "program",
  "label": "Program Unggulan",
  "ikon": "📖",
  "fields": [
   {
    "name": "unggulan",
    "label": "Program unggulan",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "ikon",
      "label": "Ikon (emoji)",
      "type": "string"
     },
     {
      "name": "judul",
      "label": "Judul",
      "type": "string"
     },
     {
      "name": "program",
      "label": "Program",
      "type": "select",
      "options": [
       "Kedua program",
       "Program Tahfizh",
       "Program Takhassus"
      ],
      "description": "Pilih program agar item ini tampil di halaman program tersebut. Kosong atau \"Kedua program\" = tampil di halaman kedua program."
     },
     {
      "name": "isi",
      "label": "Penjelasan",
      "type": "text"
     }
    ]
   },
   {
    "name": "keunggulan",
    "label": "Keunggulan singkat",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "judul",
      "label": "Judul",
      "type": "string"
     },
     {
      "name": "isi",
      "label": "Penjelasan",
      "type": "text"
     }
    ]
   },
   {
    "name": "kurikulum",
    "label": "Rincian program pembelajaran",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "ikon",
      "label": "Ikon (emoji)",
      "type": "string"
     },
     {
      "name": "judul",
      "label": "Judul",
      "type": "string"
     },
     {
      "name": "program",
      "label": "Program",
      "type": "select",
      "options": [
       "Kedua program",
       "Program Tahfizh",
       "Program Takhassus"
      ],
      "description": "Pilih program agar item ini tampil di halaman program tersebut. Kosong atau \"Kedua program\" = tampil di halaman kedua program."
     },
     {
      "name": "isi",
      "label": "Penjelasan",
      "type": "text"
     }
    ]
   },
   {
    "name": "biaya_ringan",
    "label": "Keterangan biaya ringan & cicilan",
    "type": "text"
   }
  ]
 },
 {
  "kunci": "download",
  "label": "Download",
  "ikon": "📄",
  "fields": [
   {
    "name": "daftar",
    "label": "Dokumen",
    "type": "object",
    "list": true,
    "fields": [
     {
      "name": "judul",
      "label": "Nama dokumen",
      "type": "string"
     },
     {
      "name": "kategori",
      "label": "Kategori",
      "type": "string"
     },
     {
      "name": "file",
      "label": "File (PDF/gambar)",
      "type": "file"
     }
    ]
   }
  ]
 }
];
window.BAGIAN_BERITA = {kunci:'berita',label:'Berita',ikon:'📰'};
window.BAGIAN_PENDAFTAR = {kunci:'pendaftar',label:'Pendaftar PPDB',ikon:'🧾'};
window.BAGIAN_NILAI = {kunci:'nilai_ppdb',label:'Input Nilai SPMB',ikon:'📝'};
