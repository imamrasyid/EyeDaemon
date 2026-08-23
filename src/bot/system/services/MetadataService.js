'use strict';

const BaseService = require('../core/BaseService');
const YtdlpProvider = require('../providers/YtdlpProvider');

/**
 * MetadataService
 *
 * Extracts and caches track metadata with in-memory LRU cache
 * and in-flight deduplication to avoid duplicate yt-dlp spawns.
 */
class MetadataService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);
        this.ytdlpProvider = new YtdlpProvider(options);

        this.cache = new Map();
        this.cacheTTL = options.metadataCacheTTL || 10 * 60 * 1000; // 10 mins
        this.maxCacheSize = options.maxCacheSize || 500;

        // In-flight deduplication map: key -> Promise<metadata>
        this.inFlight = new Map();
    }

    /**
     * Get track metadata from query or URL
     * @param {string} query - Search query or URL
     * @returns {Promise<Object>} Track info
     */
    async getMetadata(query) {
        if (!query || typeof query !== 'string') {
            throw new Error('Query string is required');
        }

        const key = query.trim().toLowerCase();

        // Check in-memory cache
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            this.log(`Cache hit for metadata: ${query}`, 'debug');
            return cached.data;
        }

        // Check in-flight promise to avoid duplicate yt-dlp spawns
        let pending = this.inFlight.get(key);
        if (pending) {
            this.log(`Reusing in-flight metadata request for: ${query}`, 'debug');
            return await pending;
        }

        this.log(`Fetching metadata for: ${query}`, 'info');

        const fetchPromise = (async () => {
            try {
                const raw = await this.ytdlpProvider.getMetadata(query);

                const trackInfo = {
                    title: raw.title || 'Unknown Title',
                    url: raw.webpage_url || raw.url,
                    streamUrl: raw.streamUrl || null,
                    duration: (raw.duration || 0) * 1000, // milliseconds
                    durationSec: raw.duration || 0,
                    thumbnail: raw.thumbnail || null,
                    uploader: raw.uploader || raw.channel || 'Unknown Artist',
                    source: 'youtube',
                    query: query,
                };

                // Evict oldest if full
                if (this.cache.size >= this.maxCacheSize) {
                    const firstKey = this.cache.keys().next().value;
                    this.cache.delete(firstKey);
                }

                this.cache.set(key, {
                    data: trackInfo,
                    expiresAt: Date.now() + this.cacheTTL,
                });

                return trackInfo;
            } finally {
                this.inFlight.delete(key);
            }
        })();

        this.inFlight.set(key, fetchPromise);
        return await fetchPromise;
    }

    /**
     * Invalidate cached metadata
     * @param {string} query
     */
    invalidate(query) {
        if (query) {
            this.cache.delete(query.trim().toLowerCase());
        }
    }

    /**
     * Clear all metadata cache
     */
    clearCache() {
        this.cache.clear();
    }
}

module.exports = MetadataService;
