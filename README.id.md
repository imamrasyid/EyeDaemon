# EyeDaemon Discord Bot

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Discord.js](https://img.shields.io/badge/discord.js-v14.24.2-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

**[English](README.md)** | **Bahasa Indonesia**

</div>

**EyeDaemon** adalah bot Discord yang powerful dan kaya fitur yang menghadirkan manajemen server premium dan fitur hiburan ke server Discord Anda—sepenuhnya gratis! Dibangun dengan teknologi modern (Discord.js v14 dan Node.js), EyeDaemon menggabungkan streaming musik, alat moderasi, sistem ekonomi, leveling, dan banyak lagi dalam satu solusi komprehensif.

> 🎵 **Musik multi-platform** • 🔨 **Moderasi canggih** • 💰 **Ekonomi & game** • 📈 **Sistem leveling** • 🎫 **Dukungan tiket** • 📝 **Logging komprehensif**

---

## 📋 Daftar Isi

- [Fitur](#-fitur)
- [Mulai Cepat](#-mulai-cepat)
- [Konfigurasi](#️-konfigurasi)
- [Arsitektur](#️-arsitektur)
- [Perintah](#-perintah)
- [Dokumentasi](#-dokumentasi)
- [Kontribusi](#-kontribusi)
- [Lisensi](#-lisensi)
- [Dukungan](#-dukungan)

---

## ✨ Mengapa Memilih EyeDaemon?

- **🎯 Solusi All-in-One** - Semua yang Anda butuhkan dalam satu bot
- **🆓 Sepenuhnya Gratis** - Fitur premium tanpa harga premium
- **🏗️ Arsitektur Modern** - Dibangun dengan pola MVC terinspirasi CodeIgniter untuk maintainability
- **🔧 Sangat Dapat Dikonfigurasi** - Feature flags dan opsi kustomisasi ekstensif
- **📚 Dokumentasi Lengkap** - Dokumentasi dan panduan komprehensif
- **🚀 Pengembangan Aktif** - Update dan perbaikan reguler
- **🤝 Open Source** - Pengembangan transparan dan community-driven

## 🌟 Fitur

### 🎵 Sistem Musik

- **Dukungan Multi-platform**: Putar dari YouTube, Spotify, dan SoundCloud dengan deteksi platform otomatis
- **Manajemen Antrian Canggih**: Tambah, hapus, pindah, acak, dan loop track dengan penyimpanan antrian persisten
- **Efek Audio**: Filter FFmpeg real-time termasuk bassboost, nightcore, vaporwave, 8D, dan karaoke
- **Dukungan Playlist**: Buat, simpan, dan muat playlist pribadi atau publik (maks 50 track per playlist)
- **Kontrol Volume**: Penyesuaian volume presisi (0-200%) dengan persistensi per-guild
- **Kontrol Interaktif**: Kontrol playback berbasis tombol untuk manajemen musik yang mudah
- **Persistensi Antrian**: Penyimpanan dan pemulihan antrian otomatis saat bot restart
- **Reconnection Cerdas**: Pemulihan koneksi voice otomatis dengan resumption playback
- **Fungsi Seek**: Lompat ke posisi mana pun di track saat ini
- **Caching Metadata**: Cache LRU untuk pengambilan info track cepat dengan TTL 10 menit

### 🔨 Alat Moderasi

- **Manajemen User**: Kick, ban, mute, timeout dengan durasi kustom
- **Sistem Warning**: Lacak warning dengan auto-action pada threshold
- **Auto-moderasi**: Deteksi spam, filter kata, perlindungan anti-link
- **Manajemen Role**: Auto-role, reaction role, penugasan role kustom
- **Perlindungan Server**: Anti-raid, sistem verifikasi

### 💰 Sistem Ekonomi

- **Manajemen Mata Uang**: Mata uang server dengan pelacakan saldo
- **Game Judi**: Slots, coinflip, blackjack, roulette
- **Toko Virtual**: Beli role, warna, badge, dan item kustom
- **Hadiah Harian**: Klaim bonus harian dengan pelacakan streak
- **Sistem Kerja**: Dapatkan mata uang melalui berbagai pekerjaan

### 📈 Leveling & XP

- **XP Otomatis**: Dapatkan XP dari chatting dan aktivitas voice
- **Hadiah Level**: Buka role, channel, dan benefit spesial
- **Leaderboard**: Peringkat dan statistik server-wide
- **Progresi Kustom**: Rate XP dan persyaratan level yang dapat dikonfigurasi
- **Sistem Achievement**: Buka badge dan hadiah spesial

### 🎫 Sistem Tiket

- **Tiket Dukungan**: Buat tiket dengan kategori dan prioritas
- **Penugasan Staff**: Penugasan staff otomatis berdasarkan kategori
- **Integrasi Thread**: Sistem tiket berbasis thread modern
- **Workflow Kustom**: Workflow tiket dan otomasi yang dapat dikonfigurasi

### 📝 Logging & Analitik

- **Logging Komprehensif**: Edit/hapus pesan, event member, moderasi
- **Analitik Server**: Pelacakan pertumbuhan, metrik aktivitas, statistik engagement
- **Audit Trail**: Audit trail lengkap untuk semua aktivitas server
- **Dashboard Kustom**: Lihat statistik dan tren server

## 📸 Screenshot & Demo

### Bot dalam Aksi

<div align="center">

<!-- Tambahkan screenshot Anda di sini -->
<!-- Contoh: ![Interface Bot](docs/images/bot-interface.png) -->
<!-- Contoh: ![Music Player](docs/images/music-player.png) -->

</div>

### Demo

<!-- Tambahkan GIF atau video demo di sini -->
<!-- Contoh: ![Demo](docs/images/demo.gif) -->

> **Catatan**: Screenshot dan GIF demo akan segera ditambahkan. Sementara itu, lihat [Referensi Command](docs/COMMANDS.md) untuk melihat apa yang bisa dilakukan EyeDaemon!

## 🚀 Mulai Cepat

Jalankan EyeDaemon dalam hitungan menit!

### Prasyarat

Sebelum memulai, pastikan Anda memiliki:

- **Node.js** 18.0.0 atau lebih tinggi ([Download](https://nodejs.org/))
- **Discord Bot Token** ([Buat bot](https://discord.com/developers/applications))
- **Git** untuk cloning repositori
- Pengetahuan dasar Discord.js (opsional tapi membantu)

### Instalasi

1. **Clone repositori**

   ```bash
   git clone https://github.com/imamrasyid/EyeDaemon.git
   cd eyedaemon
   ```

2. **Install dependensi**

   ```bash
   npm install
   ```

3. **Konfigurasi environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` dan tambahkan token bot Anda:

   ```env
   DISCORD_TOKEN=token_bot_anda_disini
   DISCORD_CLIENT_ID=client_id_anda_disini
   ```

4. **Jalankan bot**

   ```bash
   npm start
   ```

   Untuk development dengan auto-reload:

   ```bash
   npm run dev
   ```

🎉 **Selesai!** Bot Anda sekarang seharusnya online dan siap digunakan.

Untuk instruksi setup detail, lihat **[Panduan Setup](SETUP_GUIDE.md)** atau **[Panduan Mulai Cepat](docs/QUICK_START.md)**.

## ⚙️ Konfigurasi

### Variabel Environment

Buat file `.env` dengan variabel berikut:

```env
# Wajib
DISCORD_TOKEN=token_bot_anda_disini
DISCORD_CLIENT_ID=client_id_anda_disini
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token_here

# Opsional (dengan default)
DISCORD_PREFIX=!
FEATURE_MUSIC=true
FEATURE_MODERATION=true
FEATURE_ECONOMY=true
FEATURE_LEVELING=true
```

### Feature Flags

Aktifkan/nonaktifkan fitur dengan mengatur variabel environment ini:

- `FEATURE_MUSIC=true/false`
- `FEATURE_MODERATION=true/false`
- `FEATURE_ECONOMY=true/false`
- `FEATURE_LEVELING=true/false`
- `FEATURE_TICKETS=true/false`
- `FEATURE_LOGGING=true/false`

## 🏗️ Arsitektur

### Arsitektur MVC Terinspirasi CodeIgniter

Bot mengikuti arsitektur MVC terinspirasi CodeIgniter dengan pemisahan yang jelas antara kode framework (system layer) dan logika bisnis (application layer):

```text
src/bot/
├── system/              # Framework layer (core classes, libraries, helpers)
│   ├── core/           # Base classes (Loader, Controller, Model)
│   ├── libraries/      # Komponen reusable (VoiceManager, AudioPlayer)
│   └── helpers/        # Fungsi utility (format, validation)
│
├── application/        # Business logic layer
│   ├── controllers/    # Command handlers (MusicController, EconomyController)
│   ├── models/         # Operasi data (MusicModel, EconomyModel)
│   ├── modules/        # Definisi modul (music, economy, leveling)
│   └── config/         # File konfigurasi
│
└── bootstrap.js        # Entry point dan inisialisasi
```

### Fitur Utama

- **Pola MVC**: Controller menangani command, Model menangani data
- **Pola Loader**: Loading dan caching dependensi otomatis
- **Pemisahan Jelas**: Kode framework vs logika bisnis
- **Mudah Diperluas**: Tambah fitur baru tanpa memodifikasi core
- **Pola Konsisten**: Pendekatan yang sama di semua modul

### Komponen Inti

#### System Layer (Framework)

- **Loader**: Loading dinamis model, library, dan helper
- **Controller**: Base class untuk semua command handler
- **Model**: Base class untuk semua operasi data
- **Libraries**: Komponen reusable (VoiceManager, AudioPlayer, QueueManager)
- **Helpers**: Fungsi utility (format, validation, logger)

#### Application Layer (Logika Bisnis)

- **Controllers**: Menangani command dan interaksi Discord
- **Models**: Enkapsulasi operasi data dan logika bisnis
- **Modules**: Mendefinisikan fitur dan pemetaan command
- **Config**: Konfigurasi dan pengaturan aplikasi

### Dokumentasi

Untuk informasi arsitektur detail dan panduan migrasi:

- **[Dokumentasi Arsitektur](docs/ARCHITECTURE.md)** - Overview arsitektur lengkap
- **[Panduan Migrasi](docs/CODEIGNITER_MIGRATION_GUIDE.md)** - Panduan untuk memahami struktur baru
- **[Dokumentasi API](docs/API.md)** - Referensi API dan contoh penggunaan

## 🎵 Detail Sistem Musik

### Arsitektur

Sistem musik menggunakan arsitektur client-server terpadu:

- **Audio Server** (`src/server`): Server streaming berbasis yt-dlp dengan dukungan filter FFmpeg
- **Audio Service** (`src/bot/services/audio.service.js`): HTTP client dengan caching metadata dan retry logic
- **Player Service** (`src/bot/services/player.service.js`): Manajemen antrian, kontrol playback, dan penanganan koneksi voice
- **Playlist Service** (`src/bot/services/playlist.service.js`): Operasi CRUD playlist dan manajemen track

### Platform yang Didukung

- **YouTube**: Dukungan penuh video dan playlist dengan integrasi pencarian
- **Spotify**: Dukungan track dan playlist (otomatis dikonversi ke YouTube untuk streaming)
- **SoundCloud**: Dukungan track dan playlist
- **URL Langsung**: MP3, AAC, dan format audio lainnya via streaming HTTP

### Fitur Audio

- **Kontrol Volume**: Range 0-200% dengan penyesuaian real-time dan persistensi per-guild
- **Filter Audio**: Filter FFmpeg server-side (bassboost, nightcore, vaporwave, 8D, karaoke)
- **Manajemen Antrian**: Tambah, hapus, pindah, acak, clear dengan limit 100 track per guild
- **Mode Loop**: Off, repeat track, repeat queue dengan persistensi database
- **Fungsi Seek**: Lompat ke posisi mana pun di track saat ini dengan presisi milidetik
- **Dukungan Playlist**: Buat, simpan, muat, dan bagikan playlist (maks 50 track, 10 playlist per user)
- **Integrasi Pencarian**: Pencarian bahasa natural di semua platform yang didukung
- **Caching Metadata**: Cache LRU dengan TTL 10 menit dan cleanup otomatis
- **Persistensi Antrian**: Penyimpanan dan pemulihan otomatis state antrian saat restart
- **Reconnection Cerdas**: Pemulihan koneksi voice otomatis dengan exponential backoff
- **Kontrol Interaktif**: UI berbasis tombol untuk play/pause, skip, stop, loop, dan volume
- **Pelacakan Progress**: Progress bar real-time dan tampilan waktu yang telah berlalu
- **Idle Timeout**: Timeout dinamis (5-10 menit) berdasarkan panjang track

### Optimasi Performa

- **Caching Metadata**: Cache LRU (maks 50 entri) mengurangi panggilan API ~70%
- **Retry Logic**: Exponential backoff dengan maks 3 retry untuk error transien
- **Connection Pooling**: Reuse koneksi voice untuk meminimalkan latency
- **Batch Processing**: Loading playlist efisien dengan feedback progress
- **Resource Cleanup**: Cleanup otomatis koneksi idle dan entri cache yang expired

## 🔨 Fitur Moderasi

### Manajemen User

- **Kick**: Hapus user dengan logging alasan
- **Ban**: Ban permanen dengan sistem appeal
- **Mute**: Pembatasan voice/text sementara
- **Timeout**: Dukungan timeout native Discord
- **Warn**: Sistem warning dengan eskalasi

### Auto-Moderasi

- **Deteksi Spam**: Perlindungan flooding pesan
- **Filter Kata**: Pemblokiran kata/frasa kustom
- **Filter Link**: Blokir link mencurigakan/NSFW
- **Caps Lock**: Deteksi caps berlebihan
- **Spam Emoji**: Deteksi emoji berlebihan

## 💰 Sistem Ekonomi

### Fitur Mata Uang

- **Saldo Awal**: Jumlah awal yang dapat dikonfigurasi
- **Hadiah Harian**: Sistem klaim harian dengan streak
- **Sistem Kerja**: Berbagai jenis pekerjaan dengan hadiah berbeda
- **Sistem Transfer**: Transfer user-ke-user dengan pajak
- **Sistem Bank**: Penyimpanan aman dengan bunga

### Game

- **Slots**: Mesin slot gaya kasino
- **Coinflip**: Game peluang 50/50
- **Blackjack**: Game kartu klasik
- **Roulette**: Taruhan angka/warna
- **Lottery**: Sistem jackpot server-wide

## 📈 Sistem Leveling

### Sumber XP

- **Pesan Teks**: XP untuk chatting aktif
- **Aktivitas Voice**: XP untuk waktu di channel voice
- **Penggunaan Command**: Bonus XP untuk menggunakan command
- **Event Server**: XP untuk berpartisipasi dalam event

### Hadiah Level

- **Hadiah Role**: Buka role di level tertentu
- **Akses Channel**: Akses ke channel eksklusif
- **Unlock Command**: Buka command spesial
- **Bonus Mata Uang**: Bonus mata uang ekonomi
- **Hadiah Kustom**: Hadiah spesifik server

## 🔧 Perintah

### Perintah Musik

- `!play <lagu/url>` - Putar musik dari berbagai sumber
- `!skip` - Lewati track saat ini
- `!stop` - Hentikan playback dan clear antrian
- `!queue` - Tampilkan antrian saat ini
- `!nowplaying` - Tampilkan info track saat ini
- `!volume <0-100>` - Sesuaikan volume
- `!loop` - Toggle mode loop
- `!shuffle` - Acak antrian

### Perintah Moderasi

- `!kick <user> [alasan]` - Kick user dari server
- `!ban <user> [alasan]` - Ban user dari server
- `!mute <user> <durasi>` - Mute user
- `!warn <user> <alasan>` - Beri warning ke user
- `!clear <jumlah>` - Clear pesan
- `!slowmode <detik>` - Set slowmode

### Perintah Ekonomi

- `!balance [user]` - Cek saldo
- `!daily` - Klaim hadiah harian
- `!work` - Kerja untuk mata uang
- `!transfer <user> <jumlah>` - Transfer mata uang
- `!slots <jumlah>` - Main slots
- `!coinflip <jumlah> <heads/tails>` - Game coinflip
- `!shop` - Lihat item toko
- `!buy <item>` - Beli item dari toko

### Perintah Leveling

- `!rank [user]` - Cek level dan XP
- `!leaderboard [tipe]` - Lihat leaderboard
- `!givexp <user> <jumlah>` - Beri XP (admin)
- `!resetxp <user>` - Reset XP user (admin)

## 📊 Statistik

Bot melacak statistik komprehensif:

- Statistik penggunaan command
- Metrik aktivitas user
- Pelacakan pertumbuhan server
- Error rate dan performa
- Analitik penggunaan fitur

Lihat statistik dengan:

```bash
npm run stats
```

## 🔒 Keamanan

### Sistem Permission

- **Permission Granular**: Kontrol permission yang detail
- **Akses Berbasis Role**: Inheritance permission dari role
- **Permission Spesifik User**: Override permission role
- **Pengaturan Spesifik Guild**: Konfigurasi per-server

### Rate Limiting

- **Cooldown Command**: Cegah spam dengan cooldown yang dapat dikonfigurasi
- **Perlindungan Burst**: Lindungi dari penggunaan command cepat
- **Limit Global**: Rate limiting server-wide
- **Limit Spesifik User**: Rate limiting user individual

### Perlindungan Data

- **Penyimpanan Aman**: Penyimpanan data sensitif terenkripsi
- **Audit Logging**: Audit trail lengkap untuk semua aksi
- **Sanitasi Data**: Validasi dan sanitasi input
- **Kontrol Privasi**: Alat manajemen data user

## 🛠️ Development

### Menambahkan Fitur Baru

Bot menggunakan arsitektur MVC terinspirasi CodeIgniter. Untuk menambahkan fitur baru:

#### 1. Buat Model (Data Layer)

```javascript
// application/models/MyModel.js
const Model = require("../../system/core/Model");

class MyModel extends Model {
  constructor(instance) {
    super(instance);
  }

  async getData(id) {
    return await this.db.get("SELECT * FROM table WHERE id = ?", [id]);
  }
}

module.exports = MyModel;
```

#### 2. Buat Controller (Command Handler)

```javascript
// application/controllers/MyController.js
const Controller = require("../../system/core/Controller");

class MyController extends Controller {
  constructor(client) {
    super(client);

    // Load dependensi
    this.myModel = this.load.model("MyModel");
    this.load.helper("format");
  }

  async myCommand(interaction) {
    try {
      await interaction.deferReply();
      const data = await this.myModel.getData(interaction.user.id);
      await interaction.editReply({ content: `✅ ${data}` });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${error.message}` });
    }
  }
}

module.exports = MyController;
```

#### 3. Buat Definisi Modul

```javascript
// application/modules/mymodule/index.js
module.exports = {
  name: "MyModule",
  description: "Deskripsi modul saya",
  controllers: ["MyController"],
  models: ["MyModel"],
  commands: [
    {
      name: "mycommand",
      description: "Deskripsi command saya",
      controller: "MyController",
      method: "myCommand",
      options: [],
    },
  ],
};
```

#### 4. Daftarkan Modul

Tambahkan modul Anda ke daftar loading bootstrap di `bootstrap.js`.

Untuk panduan development detail, lihat:

- **[Dokumentasi Arsitektur](docs/ARCHITECTURE.md)** - Panduan arsitektur lengkap
- **[Panduan Migrasi](docs/CODEIGNITER_MIGRATION_GUIDE.md)** - Contoh dan pola detail

### Skema Database

Bot menggunakan skema database komprehensif dengan tabel untuk:

- Informasi guild dan member
- Data ekonomi dan leveling
- Playlist musik dan riwayat antrian
- Log moderasi dan warning
- Pengaturan dan preferensi user
- Konfigurasi server dan permission

## 📚 Dokumentasi

Dokumentasi komprehensif tersedia untuk membantu Anda memahami dan memperluas EyeDaemon:

- **[Dokumentasi Arsitektur](docs/ARCHITECTURE.md)** - Overview arsitektur lengkap dan pola desain
- **[Arsitektur Detail](docs/ARCHITECTURE_DETAILED.md)** - Dokumentasi teknis mendalam
- **[Dokumentasi API](docs/API.md)** - Referensi API dan contoh penggunaan
- **[Panduan User](docs/USER_GUIDE.md)** - Panduan user lengkap untuk semua fitur
- **[Referensi Command](docs/COMMANDS.md)** - Dokumentasi command detail
- **[Panduan Mulai Cepat](docs/QUICK_START.md)** - Mulai dengan cepat
- **[Panduan Migrasi](docs/CODEIGNITER_MIGRATION_GUIDE.md)** - Panduan untuk memahami arsitektur MVC
- **[Panduan Setup](SETUP_GUIDE.md)** - Instruksi setup detail
- **[Panduan Migrasi](MIGRATION_GUIDE.md)** - Instruksi migrasi untuk update

### Panduan Implementasi

- **[Implementasi Audio Filter](docs/implementation/AUDIO_FILTERS_IMPLEMENTATION.md)** - Detail sistem audio filter
- **[Implementasi Error Recovery](docs/implementation/ERROR_RECOVERY_IMPLEMENTATION.md)** - Penanganan error dan recovery
- **[Optimasi yt-dlp](docs/implementation/YTDLP_OPTIMIZATION.md)** - Optimasi sistem musik

## 🤝 Kontribusi

Kami menyambut kontribusi dari komunitas! Baik Anda memperbaiki bug, menambahkan fitur, atau meningkatkan dokumentasi, bantuan Anda sangat dihargai.

### Cara Berkontribusi

1. Baca **[Panduan Kontribusi](CONTRIBUTING.md)** kami untuk instruksi detail
2. Cek **[Kode Etik](CODE_OF_CONDUCT.md)** kami untuk memahami standar komunitas
3. Fork repositori dan buat branch fitur
4. Buat perubahan Anda mengikuti standar coding kami
5. Tambahkan test jika applicable
6. Submit pull request menggunakan **[template PR](.github/PULL_REQUEST_TEMPLATE.md)** kami

### Melaporkan Issue

Menemukan bug atau punya permintaan fitur? Silakan gunakan template issue kami:

- **[Laporan Bug](.github/ISSUE_TEMPLATE/bug_report.md)** - Laporkan bug dan issue
- **[Permintaan Fitur](.github/ISSUE_TEMPLATE/feature_request.md)** - Sarankan fitur baru
- **[Pertanyaan](.github/ISSUE_TEMPLATE/question.md)** - Ajukan pertanyaan tentang bot

### Gaya Kode

- Gunakan indentasi konsisten (2 spasi)
- Ikuti konvensi penamaan yang ada
- Tambahkan komentar JSDoc untuk method publik
- Jaga fungsi tetap fokus dan kecil
- Tangani error dengan graceful

Untuk detail lebih lanjut, lihat **[Panduan Kontribusi](CONTRIBUTING.md)** kami.

## 📄 Lisensi

Proyek ini dilisensikan di bawah **Lisensi ISC**. Lihat file [LICENSE](LICENSE) untuk detail.

### Legal & Kebijakan

- **[Kebijakan Privasi](PRIVACY_POLICY.md)** - Bagaimana kami menangani data Anda
- **[Ketentuan Layanan](TERMS_OF_SERVICE.md)** - Syarat dan ketentuan penggunaan
- **[Kebijakan Keamanan](SECURITY.md)** - Panduan keamanan dan pelaporan kerentanan

## 🙏 Penghargaan

- Tim Discord.js untuk library yang excellent
- Tim Discord API untuk platform yang robust
- Komunitas open source untuk berbagai dependensi
- Semua kontributor dan tester kami

## 📞 Dukungan

Butuh bantuan? Kami di sini untuk Anda!

- **[Panduan Dukungan](SUPPORT.md)** - Dapatkan bantuan dan temukan jawaban untuk pertanyaan umum
- **[Dokumentasi](docs/)** - Jelajahi dokumentasi komprehensif kami
- **[Issue Tracker](https://github.com/imamrasyid/EyeDaemon/issues)** - Laporkan bug atau minta fitur
- **[Diskusi](https://github.com/imamrasyid/EyeDaemon/discussions)** - Bergabung dengan diskusi komunitas

Untuk kerentanan keamanan, silakan lihat **[Kebijakan Keamanan](SECURITY.md)** kami.

---

<div align="center">

Dibuat dengan ❤️ oleh Tim EyeDaemon

[Dokumentasi](docs/) • [Kontribusi](CONTRIBUTING.md) • [Dukungan](SUPPORT.md) • [Changelog](CHANGELOG.md)

</div>
