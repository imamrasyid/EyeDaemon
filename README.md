# 👁️ EyeDaemon

> "Observe. Adapt. Execute."  
> A modern multi-purpose daemon for Discord — intelligent, modular, and always watching.

---

## 🚀 Overview

**EyeDaemon** adalah bot Discord modular dan event-driven yang berperan sebagai _digital guardian_ di server kamu.  
Dibangun dengan **Node.js**, **Discord.js v14**, dan **Express**, bot ini memiliki arsitektur cepat, fleksibel, dan aman untuk automasi, musik, serta integrasi sistem eksternal.

---

## 🧩 Core Features

- 🎧 **Music Streaming**

  - Menggunakan `yt-dlp` dan `@discordjs/voice` untuk audio berkualitas tinggi.
  - Mendukung berbagai filter audio (`bassboost`, `nightcore`, `vaporwave`, dll).
  - Sistem antrian cerdas dengan idle timeout dan auto-cleanup.

- ⚙️ **Modular Command System**

  - Setiap perintah berada dalam modul terpisah di folder `/commands`.
  - Mendukung hot reload dan dynamic registration.

- 🔐 **Permission Control**

  - Role-based access (misalnya fitur DJ only).
  - Menggunakan `.env` untuk konfigurasi token dan variabel rahasia.

- 🌐 **REST Interface**

  - API Express bawaan (`/stream`, `/info`, dll).
  - Siap diintegrasikan dengan dashboard atau panel kontrol eksternal.

- 🧠 **Session & State Management**
  - State per guild disimpan di memori.
  - Koneksi voice dijaga agar stabil dan efisien.

---

## 📁 Folder Structure

```
EyeDaemon/
├── src/
│   ├── commands/         # Modul command
│   ├── services/         # Logika utama (audio, player, utils)
│   ├── events/           # Handler event Discord
│   ├── server/           # API routes Express
│   ├── utils/            # Logger, helper, dsb
│   └── config.js         # Variabel konfigurasi
├── .env.example
├── package.json
├── README.md
└── LICENSE
```

---

## ⚙️ Installation

```bash
git clone https://github.com/yourusername/EyeDaemon.git
cd EyeDaemon
npm install
cp .env.example .env
```

Edit file `.env` dengan nilai sesuai:

```env
DISCORD_TOKEN=your_discord_bot_token
PREFIX=!
PORT=3000
```

---

## 🧠 Run Modes

| Mode                | Deskripsi                                     |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Mode pengembangan dengan hot reload (nodemon) |
| `npm start`         | Mode produksi                                 |
| `node src/index.js` | Jalankan manual                               |

---

## 🧾 Example Commands

| Command              | Deskripsi                                    |
| -------------------- | -------------------------------------------- |
| `!play [query]`      | Putar lagu dari YouTube atau hasil pencarian |
| `!skip`              | Lewati lagu saat ini                         |
| `!pause` / `!resume` | Pause atau lanjutkan playback                |
| `!queue`             | Tampilkan antrian lagu                       |
| `!leave`             | Bot keluar dari voice channel                |

---

## 🔍 REST Endpoints

| Endpoint         | Deskripsi                        |
| ---------------- | -------------------------------- |
| `/stream?query=` | Stream audio langsung dari query |
| `/info?query=`   | Ambil metadata via yt-dlp        |

---

## 🧱 Tech Stack

- [Node.js](https://nodejs.org/)
- [Discord.js v14](https://discord.js.org/)
- [Express](https://expressjs.com/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [Pino](https://github.com/pinojs/pino) untuk structured logging

---

## 🧰 Development Notes

- Menggunakan `spawn` daripada library berat demi performa.
- Pipeline full async (non-blocking I/O).
- Logging via `pino-pretty` agar output CLI mudah dibaca.
- Kompatibel untuk deployment via Docker.

---

## 🧑‍💻 Author

**Imam Rasyid**  
Full-stack engineer dan system designer untuk automation, reverse engineering, dan hybrid infrastructure.

> Building bridges between systems — one daemon at a time.

---

## 🪪 License

Proyek ini dilisensikan di bawah **MIT License** — lihat file [LICENSE](./LICENSE) untuk detailnya.

---

## 🧿 Tagline

> EyeDaemon watches, learns, and acts.  
> Not just a bot — a sentinel.
