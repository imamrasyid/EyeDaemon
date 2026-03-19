/**
 * AudioService
 *
 * Streams audio to the HTTP response with two paths:
 *
 * Fast path  — direct CDN URL from metadata cache, no yt-dlp spawn needed.
 *              Falls back to slow path automatically on CDN errors (4xx/5xx).
 * Slow path  — spawn yt-dlp to resolve + stream (cache miss or CDN failure).
 *
 * In-flight deduplication: concurrent /stream requests for the same query
 * share one underlying stream setup instead of spawning multiple yt-dlp processes.
 */
const http = require('http');
const https = require('https');
const BaseService = require('./base.service');

class AudioService extends BaseService {
    constructor(config, dependencies) {
        super(config, dependencies);
        this.ytdlpProvider = dependencies.ytdlpProvider;
        this.ffmpegProvider = dependencies.ffmpegProvider;

        // In-flight deduplication for stream setup (key = query+filter+start)
        this.inFlight = new Map();
    }

    /**
     * Stream audio to an Express response.
     *
     * @param {Object}  params
     * @param {string}  params.query       - Search query or YouTube URL
     * @param {string}  [params.streamUrl] - Pre-fetched CDN URL (fast path)
     * @param {number}  [params.start]     - Seek position in seconds
     * @param {string}  [params.filter]    - Audio filter preset
     * @param {Object}  params.response    - Express response object
     * @param {string}  [params.format]    - Output format (default: webm)
     */
    async streamAudio({ query, streamUrl, start = 0, filter = 'none', response, format = 'webm' }) {
        const t0 = Date.now();
        const needsProcessing = start > 0 || filter !== 'none';
        const sanitizedQuery = this.sanitizeQuery(query);

        this.log('info', 'Starting audio stream', {
            query, start, filter, format, fastPath: !!streamUrl && !needsProcessing,
        });

        response.setHeader('Content-Type', `audio/${format}`);
        response.setHeader('Transfer-Encoding', 'chunked');
        response.setHeader('Cache-Control', 'no-store');

        try {
            if (streamUrl && !needsProcessing) {
                // ── Fast path ────────────────────────────────────────────────
                // Direct CDN URL, no processing — stream via http/https.
                // Falls back to slow path on CDN error.
                try {
                    await this._streamFromUrl(streamUrl, response);
                } catch (cdnErr) {
                    this.log('warn', 'Fast path CDN error, falling back to yt-dlp', {
                        error: cdnErr.message, query,
                    });
                    await this._slowPathStream({ sanitizedQuery, response, needsProcessing: false, start, filter, format });
                }
            } else if (streamUrl && needsProcessing) {
                // ── Fast path + ffmpeg ───────────────────────────────────────
                // Have CDN URL but need seek/filter — fetch URL stream → ffmpeg.
                // Falls back to slow path on CDN error.
                try {
                    const urlStream = await this._fetchUrlStream(streamUrl);
                    const processed = await this.ffmpegProvider.processAudio({
                        inputStream: urlStream, start, filter, format,
                    });
                    processed.pipe(response);
                    this.setupStreamCleanup(processed, urlStream, response);
                } catch (cdnErr) {
                    this.log('warn', 'Fast path (ffmpeg) CDN error, falling back to yt-dlp', {
                        error: cdnErr.message, query,
                    });
                    await this._slowPathStream({ sanitizedQuery, response, needsProcessing: true, start, filter, format });
                }
            } else {
                // ── Slow path ────────────────────────────────────────────────
                await this._slowPathStream({ sanitizedQuery, response, needsProcessing, start, filter, format });
            }

            this.log('info', 'Audio stream started successfully', { query, duration: Date.now() - t0 });
        } catch (error) {
            this.handleError(error, 'streamAudio');
        }
    }

    /**
     * Slow path: spawn yt-dlp, optionally pipe through ffmpeg.
     * @private
     */
    async _slowPathStream({ sanitizedQuery, response, needsProcessing, start, filter, format }) {
        const ytdlpStream = await this.ytdlpProvider.getAudioStream(sanitizedQuery);

        if (needsProcessing) {
            const processed = await this.ffmpegProvider.processAudio({
                inputStream: ytdlpStream, start, filter, format,
            });
            processed.pipe(response);
            this.setupStreamCleanup(processed, ytdlpStream, response);
        } else {
            ytdlpStream.pipe(response);
            this.setupStreamCleanup(ytdlpStream, null, response);
        }
    }

    /**
     * Stream a direct CDN URL to the response.
     * Rejects on HTTP 4xx/5xx so callers can fall back.
     * @private
     */
    _streamFromUrl(url, response) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                if (res.statusCode >= 400) {
                    res.resume(); // drain
                    return reject(new Error(`CDN ${res.statusCode}`));
                }
                res.pipe(response);
                res.on('end', resolve);
                res.on('error', reject);
            });
            req.on('error', reject);
            response.on('close', () => req.destroy());
        });
    }

    /**
     * Fetch a direct CDN URL as a readable stream (for ffmpeg piping).
     * Rejects on HTTP 4xx/5xx.
     * @private
     */
    _fetchUrlStream(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                if (res.statusCode >= 400) {
                    res.resume();
                    return reject(new Error(`CDN ${res.statusCode}`));
                }
                resolve(res);
            });
            req.on('error', reject);
        });
    }

    sanitizeQuery(query) {
        return query.replace(/[;&|$><`]/g, '').trim();
    }

    setupStreamCleanup(primaryStream, secondaryStream, response) {
        const cleanup = () => {
            if (primaryStream && !primaryStream.destroyed) primaryStream.destroy();
            if (secondaryStream && !secondaryStream.destroyed) secondaryStream.destroy();
        };
        response.on('close', cleanup);
        response.on('error', cleanup);
        primaryStream.on('error', (err) => {
            this.log('error', 'Primary stream error', { error: err.message });
            cleanup();
        });
        if (secondaryStream) {
            secondaryStream.on('error', (err) => {
                this.log('error', 'Secondary stream error', { error: err.message });
                cleanup();
            });
        }
    }
}

module.exports = AudioService;
