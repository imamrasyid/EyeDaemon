/**
 * MetadataService
 * 
 * Service for fetching and caching track metadata from YouTube.
 * Implements LRU cache with TTL expiration to reduce external API calls.
 * 
 * Requirements: 8.1, 8.2, 8.3, 6.3
 */
const BaseService = require('./base.service');
const { NotFoundError } = require('../utils/errors');

class MetadataService extends BaseService {
    /**
     * Create a new MetadataService
     * @param {Object} config - Configuration object
     * @param {Object} dependencies - Dependencies (ytdlpProvider)
     */
    constructor(config, dependencies) {
        super(config, dependencies);
        this.ytdlpProvider = dependencies.ytdlpProvider;
        this.cache = new Map();
        this.cacheTTL = config.get('cache.ttl', 600000); // 10 minutes default
        this.maxCacheSize = config.get('cache.maxSize', 1000);
    }

    /**
     * Get track information for a query
     * @param {string} query - Search query or URL
     * @returns {Promise<Object>} Track information
     * @throws {NotFoundError} If no results found
     */
    async getTrackInfo(query) {
        const startTime = Date.now();

        // Check cache first
        const cached = this.getFromCache(query);
        if (cached) {
            this.log('debug', 'Cache hit for metadata', { query });
            return cached;
        }

        this.log('info', 'Fetching metadata', { query });

        try {
            // Fetch from yt-dlp provider
            const metadata = await this.ytdlpProvider.getMetadata(query);

            if (!metadata) {
                throw new NotFoundError(`No results found for: ${query}`);
            }

            // Transform data to consistent format (backward compatible)
            const trackInfo = {
                title: metadata.title,
                url: metadata.webpage_url || metadata.url,
                durationSec: Number(metadata.duration || 0),
                thumbnail: metadata.thumbnail || metadata.thumbnails?.pop()?.url || null,
                uploader: metadata.uploader || 'Unknown',
            };

            // Cache the result
            this.setCache(query, trackInfo);

            const duration = Date.now() - startTime;
            this.log('info', 'Metadata fetched successfully', { query, duration });

            return trackInfo;
        } catch (error) {
            this.handleError(error, 'getTrackInfo');
        }
    }

    /**
     * Get value from cache if not expired
     * @param {string} key - Cache key
     * @returns {Object|null} Cached value or null
     */
    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if expired
        if (Date.now() - entry.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            this.log('debug', 'Cache entry expired', { key });
            return null;
        }

        return entry.value;
    }

    /**
     * Set value in cache with LRU eviction
     * @param {string} key - Cache key
     * @param {Object} value - Value to cache
     */
    setCache(key, value) {
        // Implement simple LRU: if cache is full, remove oldest entry
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.log('debug', 'Cache eviction (LRU)', { evictedKey: firstKey });
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
        });

        this.log('debug', 'Cache entry set', { key, cacheSize: this.cache.size });
    }

    /**
     * Clear all cache entries
     */
    clearCache() {
        const size = this.cache.size;
        this.cache.clear();
        this.log('info', 'Cache cleared', { entriesCleared: size });
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            ttl: this.cacheTTL,
        };
    }
}

module.exports = MetadataService;
