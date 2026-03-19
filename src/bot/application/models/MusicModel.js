/**
 * MusicModel
 *
 * Fetches track metadata from the local audio server.
 *
 * Cache strategy: lightweight in-memory Map with TTL.
 * The audio server (MetadataService) already has its own in-memory cache,
 * so this layer only saves the HTTP round-trip on repeated plays within
 * the same bot session. No remote DB writes — eliminates the ~1s Turso
 * slow-query that was observed on every /play command.
 */

const Model = require('../../system/core/Model');
const axios = require('axios');
const config = require('../config/config');

class MusicModel extends Model {
    constructor(instance) {
        super(instance);

        this.audioServerUrl = config.audio.sourceEndpoint;

        // In-memory cache: normalizedQuery → { data, expiresAt }
        this._cache = new Map();
        this._cacheTTL = 10 * 60 * 1000; // 10 minutes in ms
        this._maxCacheSize = 500;
    }

    /**
     * Get track information from query (URL or search term).
     * @param {string} query
     * @returns {Promise<Object>} Track info
     */
    async getTrackInfo(query) {
        const key = query.trim().toLowerCase();

        // Cache hit
        const cached = this._cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            this.log(`Cache hit: ${query}`, 'debug');
            return cached.data;
        }

        this.log(`Fetching track info: ${query}`, 'debug');

        const response = await axios.get(`${this.audioServerUrl}/api/audio/metadata`, {
            params: { query },
            timeout: 15000,
        });

        if (!response.data || !response.data.title) {
            throw new Error('Invalid response from audio server');
        }

        const info = response.data;

        const trackInfo = {
            title: info.title,
            url: info.url || info.webpage_url,
            // Server returns durationSec (seconds) — convert to ms for internal use
            duration: (info.durationSec || info.duration || 0) * 1000,
            thumbnail: info.thumbnail || null,
            author: info.uploader || 'Unknown',
            source: 'youtube',
            query,
        };

        // Evict oldest entry if at capacity
        if (this._cache.size >= this._maxCacheSize) {
            this._cache.delete(this._cache.keys().next().value);
        }

        this._cache.set(key, { data: trackInfo, expiresAt: Date.now() + this._cacheTTL });

        return trackInfo;
    }

    /**
     * Invalidate a specific cache entry (e.g. after a CDN error).
     * @param {string} query
     */
    invalidate(query) {
        this._cache.delete(query.trim().toLowerCase());
    }

    /**
     * Clear the entire in-memory cache.
     */
    clearCache() {
        this._cache.clear();
        this.log('Track cache cleared', 'info');
    }
}

module.exports = MusicModel;
