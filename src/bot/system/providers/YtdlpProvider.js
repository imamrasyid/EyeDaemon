'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { AudioError } = require('../core/Errors');
const logger = require('../helpers/LoggerHelper');

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//;

/**
 * YtdlpProvider - Wrapper for yt-dlp operations
 * Handles metadata fetching and audio stream extraction from YouTube
 */
class YtdlpProvider {
    constructor(config = {}) {
        this.config = config;

        // Auto-detect bundled yt-dlp from node_modules if available (except on Android/Termux)
        let defaultPath = 'yt-dlp';
        if (process.platform !== 'android') {
            try {
                const bundledWin = path.resolve(__dirname, '../../../../node_modules/yt-dlp-exec/bin/yt-dlp.exe');
                const bundledUnix = path.resolve(__dirname, '../../../../node_modules/yt-dlp-exec/bin/yt-dlp');
                if (process.platform === 'win32' && fs.existsSync(bundledWin)) {
                    defaultPath = bundledWin;
                } else if (fs.existsSync(bundledUnix)) {
                    defaultPath = bundledUnix;
                }
            } catch {}
        }

        this.ytdlpPath = config.ytdlpPath || process.env.YTDLP_PATH || defaultPath;
        this.timeout = config.ytdlpTimeout || 30000;

        // Prefer WebM/Opus (format 251) with fallback to any best audio
        this.audioFormat = config.audioFormat || process.env.YTDLP_AUDIO_FORMAT || '251/bestaudio[ext=webm]/bestaudio/ba/b';

        // YouTube player clients (android bypasses SABR/403 blocks)
        this.playerClients = config.playerClients || process.env.YTDLP_PLAYER_CLIENT || 'android,web';

        // Performance flags
        this.socketTimeout = config.socketTimeout || 10;
        this.extractorRetries = config.extractorRetries || 2;

        // Authentication — cookies file takes priority over browser
        this.cookiesFile = config.ytdlpCookiesFile || process.env.YTDLP_COOKIES_FILE || null;
        this.cookiesBrowser = config.ytdlpCookiesBrowser || process.env.YTDLP_COOKIES_BROWSER || null;
    }

    /**
     * Resolve input string — direct URL or ytsearch prefix
     * @param {string} query
     * @returns {string}
     */
    resolveInput(query) {
        return YOUTUBE_URL_REGEX.test(query) ? query : `ytsearch1:${query}`;
    }

    /**
     * Common yt-dlp performance flags shared by all invocations
     * @returns {string[]}
     */
    commonFlags() {
        const flags = [
            '--no-update',                          // Never check for updates
            '--no-playlist',                        // Never expand playlists
            '--no-check-certificate',               // Skip SSL handshake overhead
            '--no-cache-dir',                       // Skip disk cache I/O
            '--socket-timeout', String(this.socketTimeout),
            '--extractor-retries', String(this.extractorRetries),
            '--extractor-args', `youtube:player_client=${this.playerClients}`,
            '--no-warnings',
            '--quiet',
        ];

        // Cookie auth — file takes priority over browser
        if (this.cookiesFile) {
            flags.push('--cookies', this.cookiesFile);
        } else if (this.cookiesBrowser) {
            flags.push('--cookies-from-browser', this.cookiesBrowser);
        }

        return flags;
    }

    /**
     * Get metadata for a search query or URL.
     * Also returns the direct stream URL so callers can avoid a second yt-dlp spawn.
     * @param {string} query - Search query or YouTube URL
     * @returns {Promise<Object>} Metadata object (includes streamUrl)
     */
    async getMetadata(query) {
        const input = this.resolveInput(query);

        return new Promise((resolve, reject) => {
            const args = [
                '-j',               // Dump JSON, no download
                '-f', this.audioFormat,
                ...this.commonFlags(),
                '--no-write-thumbnail',
                '--no-write-description',
                '--no-write-info-json',
                input,
            ];

            logger.debug('Spawning yt-dlp for metadata', { query });

            const proc = spawn(this.ytdlpPath, args);
            let output = '';
            let errorOutput = '';

            proc.stdout.on('data', (data) => { output += data.toString(); });
            proc.stderr.on('data', (data) => { errorOutput += data.toString(); });

            const timeoutId = setTimeout(() => {
                logger.warn('yt-dlp metadata timeout', { query });
                proc.kill('SIGTERM');
                reject(new AudioError('yt-dlp metadata fetch timed out'));
            }, this.timeout);

            proc.on('close', (code) => {
                clearTimeout(timeoutId);

                if (code !== 0) {
                    logger.error('yt-dlp metadata failed', { code, error: errorOutput, query });
                    return reject(new AudioError(`yt-dlp metadata failed: ${errorOutput}`));
                }

                try {
                    const data = JSON.parse(output);
                    const result = data.entries?.[0] || data;

                    // Only attach streamUrl if it is a real CDN URL (not a youtube.com watch URL)
                    const rawUrl = result.url || '';
                    let isDirectCdn = false;
                    if (rawUrl) {
                        try {
                            const urlObj = new URL(rawUrl);
                            const hostname = urlObj.hostname.toLowerCase();
                            const isYoutubeDomain =
                                hostname === 'youtube.com' ||
                                hostname === 'www.youtube.com' ||
                                hostname === 'youtu.be' ||
                                hostname === 'www.youtu.be' ||
                                hostname.endsWith('.youtube.com') ||
                                hostname.endsWith('.youtu.be');
                            isDirectCdn = !isYoutubeDomain;
                        } catch (e) {
                            isDirectCdn = false;
                        }
                    }
                    result.streamUrl = isDirectCdn ? rawUrl : null;

                    logger.debug('yt-dlp metadata fetched', { query, title: result.title });
                    resolve(result);
                } catch (err) {
                    logger.error('Failed to parse yt-dlp metadata', { error: err.message });
                    reject(new AudioError('Failed to parse track metadata'));
                }
            });

            proc.on('error', (err) => {
                clearTimeout(timeoutId);
                logger.error('yt-dlp spawn error', { error: err.message, query });
                reject(new AudioError(`yt-dlp spawn error: ${err.message}`));
            });
        });
    }

    /**
     * Get audio stream for a search query or URL.
     * Spawns yt-dlp and pipes stdout directly.
     * @param {string} query - Search query or YouTube URL
     * @returns {Promise<import('stream').Readable>}
     */
    async getAudioStream(query) {
        const input = this.resolveInput(query);

        const args = [
            '-f', this.audioFormat,
            '--skip-unavailable-fragments',
            '-o', '-',          // Output to stdout
            ...this.commonFlags(),
            input,
        ];

        logger.debug('Spawning yt-dlp for audio stream', { query });

        const proc = spawn(this.ytdlpPath, args);

        let timeoutId = setTimeout(() => {
            logger.warn('yt-dlp stream start timeout', { query });
            proc.kill('SIGTERM');
        }, this.timeout);

        let streamStarted = false;
        proc.stdout.once('data', () => {
            if (!streamStarted) {
                streamStarted = true;
                clearTimeout(timeoutId);
                logger.debug('yt-dlp stream started', { query });
            }
        });

        proc.on('close', (code) => {
            clearTimeout(timeoutId);
            if (code !== 0 && code !== null) {
                logger.error('yt-dlp stream closed with error', { code, query });
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeoutId);
            logger.error('yt-dlp stream spawn error', { error: err.message, query });
        });

        let errorOutput = '';
        proc.stderr.on('data', (data) => { errorOutput += data.toString(); });
        proc.stderr.on('end', () => {
            if (errorOutput) logger.debug('yt-dlp stderr', { error: errorOutput, query });
        });

        return proc.stdout;
    }
}

module.exports = YtdlpProvider;
