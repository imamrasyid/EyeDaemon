/**
 * MusicModel
 * 
 * Model for fetching track information from various sources.
 * Handles YouTube and Spotify track fetching via local audio server.
 * Updated to use database-backed cache instead of in-memory LRU cache.
 */

const Model = require('../../system/core/Model');
const axios = require('axios');
const config = require('../config/config');
const { v4: uuidv4 } = require('uuid');

class MusicModel extends Model {
    /**
     * Create a new MusicModel instance
     * @param {Object} instance - The parent instance
     */
    constructor(instance) {
        super(instance);

        // Use track_metadata_cache table for database-backed caching
        this.tableName = 'track_metadata_cache';

        // Audio server endpoint
        this.audioServerUrl = config.audio.sourceEndpoint || 'http://localhost:3000';

        // Cache TTL: 10 minutes (in seconds)
        this.cacheTTL = 10 * 60;

        // Cleanup interval: 1 hour
        this.cleanupInterval = 60 * 60 * 1000;

        // Start cleanup job
        this._startCleanupJob();
    }

    /**
     * Get track information from query (URL or search term)
     * Uses database-backed cache with TTL
     * @param {string} query - URL or search query
     * @returns {Promise<Object>} Track information
     */
    async getTrackInfo(query) {
        try {
            // Check database cache first
            const cacheKey = this.getCacheKey(query);
            const cached = await this._getCachedTrack(cacheKey);

            if (cached) {
                this.log(`Cache hit for track: ${query}`, 'debug');

                // Update hit count
                await this._incrementHitCount(cached.id);

                return {
                    title: cached.track_title,
                    url: cached.track_url,
                    duration: cached.track_duration,
                    thumbnail: cached.track_thumbnail,
                    author: cached.track_author,
                    source: cached.source,
                    query: query
                };
            }

            this.log(`Cache miss for track: ${query}`, 'debug');

            // Request metadata from local audio server
            const response = await axios.get(`${this.audioServerUrl}/api/audio/metadata`, {
                params: { query },
                timeout: 10000, // 10 second timeout
            });

            if (!response.data || !response.data.title) {
                throw new Error('Invalid response from audio server');
            }

            const info = response.data;

            const trackInfo = {
                title: info.title,
                url: info.url || info.webpage_url,
                duration: (info.duration || info.durationSec || 0) * 1000, // Convert to milliseconds
                thumbnail: info.thumbnail || null,
                author: info.uploader || 'Unknown',
                source: 'youtube',
                query: query
            };

            // Cache the result in database
            await this._cacheTrack(cacheKey, trackInfo);

            return trackInfo;
        } catch (error) {
            this.log(`Failed to get track info: ${error.message}`, 'error');
            throw new Error(`Failed to fetch track: ${error.message}`);
        }
    }

    /**
     * Generate cache key for a query
     * Normalizes the query to improve cache hit rate
     * @param {string} query - Track query
     * @returns {string} Cache key
     */
    getCacheKey(query) {
        // Normalize query for better cache hits
        return query.trim().toLowerCase();
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>} Cache statistics
     */
    async getCacheStats() {
        try {
            const now = Math.floor(Date.now() / 1000);

            // Total cached tracks
            const totalResult = await this.query(
                `SELECT COUNT(*) as total FROM ${this.tableName}`,
                []
            );

            // Active (non-expired) tracks
            const activeResult = await this.query(
                `SELECT COUNT(*) as active FROM ${this.tableName} WHERE expires_at > ?`,
                [now]
            );

            // Total hit count
            const hitsResult = await this.query(
                `SELECT SUM(hit_count) as total_hits FROM ${this.tableName}`,
                []
            );

            // Top 10 most accessed tracks
            const topTracks = await this.query(
                `SELECT query, track_title, hit_count 
                 FROM ${this.tableName} 
                 ORDER BY hit_count DESC 
                 LIMIT 10`,
                []
            );

            return {
                totalCached: totalResult[0]?.total || 0,
                activeCached: activeResult[0]?.active || 0,
                totalHits: hitsResult[0]?.total_hits || 0,
                topTracks: topTracks || []
            };
        } catch (error) {
            this.log(`Error getting cache stats: ${error.message}`, 'error');
            return {
                totalCached: 0,
                activeCached: 0,
                totalHits: 0,
                topTracks: []
            };
        }
    }

    /**
     * Clear expired cache entries
     * @returns {Promise<number>} Number of entries cleared
     */
    async clearExpiredCache() {
        try {
            const now = Math.floor(Date.now() / 1000);

            const result = await this.query(
                `DELETE FROM ${this.tableName} WHERE expires_at <= ?`,
                [now]
            );

            const cleared = result.changes || 0;

            if (cleared > 0) {
                this.log(`Cleared ${cleared} expired cache entries`, 'info');
            }

            return cleared;
        } catch (error) {
            this.log(`Error clearing expired cache: ${error.message}`, 'error');
            return 0;
        }
    }

    /**
     * Clear all track cache
     * @returns {Promise<void>}
     */
    async clearCache() {
        try {
            await this.query(`DELETE FROM ${this.tableName}`, []);
            this.log('Track cache cleared', 'info');
        } catch (error) {
            this.log(`Error clearing cache: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get cached track from database
     * @private
     * @param {string} cacheKey - Cache key
     * @returns {Promise<Object|null>} Cached track or null
     */
    async _getCachedTrack(cacheKey) {
        try {
            const now = Math.floor(Date.now() / 1000);

            const result = await this.query(
                `SELECT * FROM ${this.tableName} WHERE query = ? AND expires_at > ?`,
                [cacheKey, now]
            );

            if (result && result.length > 0) {
                return result[0];
            }

            return null;
        } catch (error) {
            this.log(`Error getting cached track: ${error.message}`, 'warn');
            return null;
        }
    }

    /**
     * Cache track in database
     * @private
     * @param {string} cacheKey - Cache key
     * @param {Object} trackInfo - Track information
     * @returns {Promise<void>}
     */
    async _cacheTrack(cacheKey, trackInfo) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = now + this.cacheTTL;
            const cacheId = uuidv4();

            // Parse metadata if it's a string
            let metadata = {};
            if (trackInfo.metadata) {
                if (typeof trackInfo.metadata === 'string') {
                    try {
                        metadata = JSON.parse(trackInfo.metadata);
                    } catch (e) {
                        metadata = {};
                    }
                } else {
                    metadata = trackInfo.metadata;
                }
            }

            await this.upsert(
                {
                    id: cacheId,
                    query: cacheKey,
                    track_url: trackInfo.url,
                    track_title: trackInfo.title,
                    track_duration: trackInfo.duration,
                    track_author: trackInfo.author,
                    track_thumbnail: trackInfo.thumbnail,
                    source: trackInfo.source || 'youtube',
                    metadata: JSON.stringify(metadata),
                    hit_count: 1,
                    created_at: now,
                    expires_at: expiresAt
                },
                ['query']
            );

            this.log(`Cached track: ${trackInfo.title}`, 'debug');
        } catch (error) {
            this.log(`Error caching track: ${error.message}`, 'warn');
            // Don't throw - caching failure shouldn't break the flow
        }
    }

    /**
     * Increment hit count for cached track
     * @private
     * @param {string} cacheId - Cache entry ID
     * @returns {Promise<void>}
     */
    async _incrementHitCount(cacheId) {
        try {
            await this.query(
                `UPDATE ${this.tableName} SET hit_count = hit_count + 1 WHERE id = ?`,
                [cacheId]
            );
        } catch (error) {
            this.log(`Error incrementing hit count: ${error.message}`, 'warn');
            // Don't throw - hit count update failure shouldn't break the flow
        }
    }

    /**
     * Start cleanup job for expired cache entries
     * @private
     */
    _startCleanupJob() {
        // Run cleanup every hour
        this.cleanupTimer = setInterval(async () => {
            try {
                const cleared = await this.clearExpiredCache();
                if (cleared > 0) {
                    this.log(`Cleanup job cleared ${cleared} expired cache entries`, 'info');
                }
            } catch (error) {
                this.log(`Error in cleanup job: ${error.message}`, 'error');
            }
        }, this.cleanupInterval);

        this.log('Started cache cleanup job (runs every 1 hour)', 'info');
    }

    /**
     * Stop cleanup job
     */
    stopCleanupJob() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            this.log('Stopped cache cleanup job', 'info');
        }
    }
}

module.exports = MusicModel;
