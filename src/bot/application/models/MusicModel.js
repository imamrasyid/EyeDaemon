'use strict';

const Model = require('../../system/core/Model');
const MetadataService = require('../../system/services/MetadataService');

/**
 * MusicModel
 *
 * Provides track metadata retrieval directly in-process using MetadataService
 * with in-memory caching and in-flight request deduplication.
 */
class MusicModel extends Model {
    constructor(instance) {
        super(instance);
        this.metadataService = new MetadataService(instance);
    }

    /**
     * Get track information from query (URL or search term).
     * @param {string} query
     * @returns {Promise<Object>} Track info
     */
    async getTrackInfo(query) {
        if (!query) {
            throw new Error('Query is required');
        }

        const info = await this.metadataService.getMetadata(query);

        return {
            title: info.title,
            url: info.url,
            streamUrl: info.streamUrl,
            duration: info.duration, // in ms
            durationSec: info.durationSec,
            thumbnail: info.thumbnail,
            author: info.uploader || 'Unknown',
            source: info.source || 'youtube',
            query,
        };
    }

    /**
     * Invalidate a specific cache entry
     * @param {string} query
     */
    invalidate(query) {
        this.metadataService.invalidate(query);
    }

    /**
     * Clear the metadata cache
     */
    clearCache() {
        this.metadataService.clearCache();
    }
}

module.exports = MusicModel;
