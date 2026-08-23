'use strict';

const http = require('http');
const https = require('https');
const BaseService = require('../core/BaseService');
const YtdlpProvider = require('../providers/YtdlpProvider');
const FfmpegProvider = require('../providers/FfmpegProvider');

/**
 * AudioStreamService
 *
 * Provides in-process audio stream extraction.
 *
 * Fast path  — direct CDN URL (from pre-fetched metadata), avoiding yt-dlp spawn.
 *              Falls back to slow path automatically on CDN errors (e.g. 403 expired URL).
 * Slow path  — spawn yt-dlp directly to pipe audio stream.
 *
 * Supports audio filters (bassboost, nightcore, vaporwave, etc.) and seeking.
 */
class AudioStreamService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);
        this.ytdlpProvider = new YtdlpProvider(options);
        this.ffmpegProvider = new FfmpegProvider(options);

        // In-flight deduplication for identical stream queries
        this.inFlight = new Map();
    }

    /**
     * Get a readable audio stream for Discord playback or HTTP response
     * @param {Object} params
     * @param {string} params.query - Track query or URL
     * @param {string} [params.streamUrl] - Direct CDN URL if pre-fetched
     * @param {number} [params.start] - Start position in seconds
     * @param {string} [params.filter] - Audio filter preset
     * @param {string} [params.format] - Audio format (default: 'webm')
     * @returns {Promise<import('stream').Readable>} Readable audio stream
     */
    async getAudioStream({ query, streamUrl, start = 0, filter = 'none', format = 'webm' }) {
        const sanitizedQuery = this.sanitizeQuery(query);
        const inflightKey = `${sanitizedQuery}|${filter}|${start}`;

        this.log(`Requesting audio stream: "${query}" (seek=${start}s, filter=${filter})`, 'debug');

        if (streamUrl) {
            try {
                const urlStream = await this._fetchUrlStream(streamUrl);
                return this.ffmpegProvider.processAudio({
                    inputStream: urlStream,
                    start,
                    filter,
                    format,
                });
            } catch (cdnErr) {
                this.log(`Fast path CDN error (${cdnErr.message}), falling back to yt-dlp for: ${query}`, 'warn');
                return await this._slowPathStream({ sanitizedQuery, inflightKey, start, filter, format });
            }
        } else {
            return await this._slowPathStream({ sanitizedQuery, inflightKey, start, filter, format });
        }
    }

    /**
     * Slow path stream resolution using yt-dlp spawn + FFmpeg transcoding
     * @private
     */
    async _slowPathStream({ sanitizedQuery, inflightKey, start, filter, format }) {
        let streamPromise = this.inFlight.get(inflightKey);
        if (!streamPromise) {
            streamPromise = this.ytdlpProvider.getAudioStream(sanitizedQuery).finally(() => {
                this.inFlight.delete(inflightKey);
            });
            this.inFlight.set(inflightKey, streamPromise);
        }

        const ytdlpStream = await streamPromise;

        return this.ffmpegProvider.processAudio({
            inputStream: ytdlpStream,
            start,
            filter,
            format,
        });
    }

    /**
     * Fetch direct CDN URL as a Readable stream
     * @private
     */
    _fetchUrlStream(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                if (res.statusCode >= 400) {
                    res.resume(); // drain
                    return reject(new Error(`CDN HTTP ${res.statusCode}`));
                }
                resolve(res);
            });
            req.on('error', reject);
        });
    }

    sanitizeQuery(query) {
        if (!query) return '';
        return String(query).replace(/[;&|$><`]/g, '').trim();
    }
}

module.exports = AudioStreamService;
