/**
 * MetadataService
 *
 * Fetches and caches track metadata from YouTube via yt-dlp.
 *
 * Improvements:
 * - In-flight deduplication: concurrent requests for the same query share one yt-dlp spawn
 * - streamUrl exposed so audio.service can skip a second yt-dlp spawn
 * - LRU in-memory cache with TTL
 */
const BaseService = require('./base.service');
const { NotFoundError } = require('../utils/errors');

class MetadataService extends BaseService {
    constructor(config, dependencies) {
        super(config, dependencies);
        this.ytdlpProvider = dependencies.ytdlpProvider;

        // LRU cache: key → { value, timestamp }
        this.cache = new Map();
        this.cacheTTL = config.get('cache.ttl', 600000);       // 10 min
        this.maxCacheSize = config.get('cache.maxSize', 1000);

        // In-flight deduplication: key → Promise
        // If two requests arrive for the same query simultaneously, the second
        // one awaits the same Promise instead of spawning a second yt-dlp process.
        this.inFlight = new Map();
    }

    /**
     * Get track information for a query.
     * @param {string} query - Search query or YouTube URL
     * @returns {Promise<Object>} Track information (includes streamUrl)
     */
    async getTrackInfo(query) {
        const normalizedQuery = query.trim().toLowerCase();

        // 1. Cache hit
        const cached = this.getFromCache(normalizedQuery);
        if (cached) {
            this.log('debug', 'Cache hit for metadata', { query });
            return cached;
        }

        // 2. In-flight deduplication — reuse existing fetch if one is running
        if (this.inFlight.has(normalizedQuery)) {
            this.log('debug', 'Reusing in-flight metadata request', { query });
            return this.inFlight.get(normalizedQuery);
        }

        // 3. Start new fetch and register it as in-flight
        const fetchPromise = this._fetchAndCache(query, normalizedQuery).finally(() => {
            this.inFlight.delete(normalizedQuery);
        });

        this.inFlight.set(normalizedQuery, fetchPromise);
        return fetchPromise;
    }

    /**
     * @private
     */
    async _fetchAndCache(query, normalizedQuery) {
        const startTime = Date.now();
        this.log('info', 'Fetching metadata', { query });

        try {
            const metadata = await this.ytdlpProvider.getMetadata(query);

            if (!metadata) {
                throw new NotFoundError(`No results found for: ${query}`);
            }

            const trackInfo = {
                title: metadata.title,
                url: metadata.webpage_url || metadata.url,
                durationSec: Number(metadata.duration || 0),
                thumbnail: metadata.thumbnail || metadata.thumbnails?.pop()?.url || null,
                uploader: metadata.uploader || 'Unknown',
                // Direct CDN URL — lets audio.service skip a second yt-dlp spawn.
                // YouTube CDN URLs are valid for ~6h but we only cache for 10 min,
                // so expiry is not a concern in normal usage.
                streamUrl: metadata.streamUrl || null,
            };

            this.setCache(normalizedQuery, trackInfo);

            this.log('info', 'Metadata fetched successfully', { query, duration: Date.now() - startTime });
            return trackInfo;
        } catch (error) {
            this.handleError(error, 'getTrackInfo');
        }
    }

    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    setCache(key, value) {
        if (this.cache.size >= this.maxCacheSize) {
            // Evict oldest (first inserted) entry
            this.cache.delete(this.cache.keys().next().value);
        }
        this.cache.set(key, { value, timestamp: Date.now() });
    }

    clearCache() {
        const size = this.cache.size;
        this.cache.clear();
        this.log('info', 'Cache cleared', { entriesCleared: size });
    }

    getCacheStats() {
        return { size: this.cache.size, maxSize: this.maxCacheSize, ttl: this.cacheTTL };
    }
}

module.exports = MetadataService;
