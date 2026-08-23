# AGENTS.md — EyeDaemon

EyeDaemon is a feature-rich, high-performance Discord bot built with **discord.js v14** using a **unified runtime architecture** (in-process audio streaming pipeline + embedded HTTP API + centralized LibSQL/SQLite database).

## Architecture Highlights

- **Unified In-Process Runtime**: The audio streaming server and bot run inside the **same Node.js process**. No separate Express server process or HTTP loopbacks needed for music streaming.
- **In-Process Audio Pipeline**: `AudioStreamService` generates WebM/Opus audio streams directly via `YtdlpProvider` and `FfmpegProvider`, delivering them seamlessly to `@discordjs/voice` with real-time filters (bassboost, nightcore, 8d, etc.).
- **Embedded HTTP & Health API**: `HttpServer` runs embedded within the bot process on `PORT` (default 3000) for `/health` checks, metrics, and audio metadata inspection.
- **Synchronized Centralized Database**: Powered by LibSQL (`@libsql/client`). Supports local zero-config SQLite (`file:./data/eyedaemon.db` or `:memory:`) and remote distributed Turso DB (`libsql://...`).
- **Standardized Schema**: Full model, service, and migration alignment across guilds, user profiles, economy, leveling, moderation, tickets, reaction roles, and playlist state.

## Entrypoints

- Bot Entrypoint: `src/bot/index.js` -> `src/bot/bootstrap.js`
- Core System: `src/bot/system/` (core, libraries, services, providers, server)
- Application Features: `src/bot/application/` (modules, controllers, services, models)

## Running

```bash
cp .env.example .env        # Copy environment configuration
npm start                   # Start unified bot (node src/bot/index.js)
npm run dev                 # Start bot with nodemon for development
```

### Environment Configuration

`.env` minimal setup:
- `DISCORD_TOKEN`: Discord Bot Token
- `DISCORD_CLIENT_ID`: Discord Application Client ID
- `TURSO_DATABASE_URL`: Defaults to `file:./data/eyedaemon.db` (local SQLite, no auth token required) or `libsql://...` (Turso remote with `TURSO_AUTH_TOKEN`).

## Database & Migrations

```bash
npm run migrate             # Run all pending schema migrations
npm run migrate:status      # Check migration status and history
npm run migrate:rollback    # Rollback the last migration batch
```

Works seamlessly both offline with local SQLite files and online with remote Turso DB.

## Dependencies for Music

- `ffmpeg-static`: Bundled binary for audio processing and real-time DSP filter piping.
- `yt-dlp`: Binary in system `PATH` or custom path configured in `YTDLP_PATH`.
- YouTube authentication: Set `YTDLP_COOKIES_FILE` or `YTDLP_COOKIES_BROWSER` (e.g. `chrome`) to bypass YouTube bot blocks.

## Code Style & Architecture

- CommonJS (`require` / `module.exports`), `"type": "commonjs"`.
- 2-space indentation, single quotes, semicolons.
- `camelCase` for variables and functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants.
- Structure:
  - `system/`: Framework core, libraries, managers, providers, initialization, and embedded HTTP server.
  - `application/`: Domain logic structured into MVC (`models`, `services`, `controllers`, `modules`).
