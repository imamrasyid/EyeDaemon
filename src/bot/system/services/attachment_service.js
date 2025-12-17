/**
 * Attachment Service
 * 
 * Handles file uploads, streamed attachments, and CDN URL management
 */

const { AttachmentBuilder } = require('discord.js');
const logger = require('../helpers/logger_helper');
const { DatabaseError } = require('../core/Errors');

class AttachmentService {
    /**
     * Create a new AttachmentService instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.attachment_cache = new Map();
        this.cdn_cache = new Map();
    }

    /**
     * Create attachment from buffer
     * @param {Buffer} buffer - File buffer
     * @param {string} filename - Filename
     * @param {Object} options - Attachment options
     * @returns {AttachmentBuilder} Attachment builder
     */
    create_from_buffer(buffer, filename, options = {}) {
        try {
            const attachment = new AttachmentBuilder(buffer, {
                name: filename,
                description: options.description,
            });

            return attachment;
        } catch (error) {
            logger.error('Failed to create attachment from buffer', {
                error: error.message,
                filename,
            });
            throw new DatabaseError('Failed to create attachment', {
                originalError: error.message,
            });
        }
    }

    /**
     * Create attachment from URL
     * @param {string} url - File URL
     * @param {string} filename - Filename
     * @param {Object} options - Attachment options
     * @returns {Promise<AttachmentBuilder>} Attachment builder
     */
    async create_from_url(url, filename, options = {}) {
        try {
            // Check cache first
            const cache_key = `${url}-${filename}`;
            if (this.attachment_cache.has(cache_key)) {
                const cached = this.attachment_cache.get(cache_key);
                return this.create_from_buffer(cached.buffer, filename, options);
            }

            // Fetch file
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.statusText}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());

            // Cache the attachment
            if (options.cache !== false) {
                this.attachment_cache.set(cache_key, {
                    buffer,
                    timestamp: Date.now(),
                });

                // Cleanup old cache entries
                this._cleanup_cache();
            }

            return this.create_from_buffer(buffer, filename, options);
        } catch (error) {
            logger.error('Failed to create attachment from URL', {
                error: error.message,
                url,
                filename,
            });
            throw new DatabaseError('Failed to create attachment from URL', {
                originalError: error.message,
            });
        }
    }

    /**
     * Create attachment from stream
     * @param {Stream} stream - File stream
     * @param {string} filename - Filename
     * @param {Object} options - Attachment options
     * @returns {Promise<AttachmentBuilder>} Attachment builder
     */
    async create_from_stream(stream, filename, options = {}) {
        try {
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            const buffer = Buffer.concat(chunks);
            return this.create_from_buffer(buffer, filename, options);
        } catch (error) {
            logger.error('Failed to create attachment from stream', {
                error: error.message,
                filename,
            });
            throw new DatabaseError('Failed to create attachment from stream', {
                originalError: error.message,
            });
        }
    }

    /**
     * Get CDN URL for Discord asset
     * @param {string} asset_type - Asset type (avatar, banner, icon, etc.)
     * @param {string} asset_id - Asset ID
     * @param {string} hash - Asset hash
     * @param {Object} options - URL options
     * @returns {string} CDN URL
     */
    get_cdn_url(asset_type, asset_id, hash, options = {}) {
        const cache_key = `${asset_type}-${asset_id}-${hash}`;
        if (this.cdn_cache.has(cache_key)) {
            return this.cdn_cache.get(cache_key);
        }

        const size = options.size || 4096;
        const format = options.format || (hash.startsWith('a_') ? 'gif' : 'png');
        const animated = hash.startsWith('a_');

        let url;
        switch (asset_type) {
            case 'avatar':
                url = `https://cdn.discordapp.com/avatars/${asset_id}/${hash}.${format}?size=${size}`;
                break;
            case 'banner':
                url = `https://cdn.discordapp.com/banners/${asset_id}/${hash}.${format}?size=${size}`;
                break;
            case 'icon':
                url = `https://cdn.discordapp.com/icons/${asset_id}/${hash}.${format}?size=${size}`;
                break;
            case 'splash':
                url = `https://cdn.discordapp.com/splashes/${asset_id}/${hash}.${format}?size=${size}`;
                break;
            default:
                throw new Error(`Unknown asset type: ${asset_type}`);
        }

        // Cache the URL
        this.cdn_cache.set(cache_key, url);
        return url;
    }

    /**
     * Validate image format
     * @param {Buffer} buffer - Image buffer
     * @returns {Object} Validation result
     */
    validate_image(buffer) {
        // Check magic bytes for common image formats
        const png_signature = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        const jpeg_signature = Buffer.from([0xff, 0xd8, 0xff]);
        const gif_signature = Buffer.from([0x47, 0x49, 0x46, 0x38]);

        if (buffer.slice(0, 4).equals(png_signature)) {
            return { valid: true, format: 'png' };
        }

        if (buffer.slice(0, 3).equals(jpeg_signature)) {
            return { valid: true, format: 'jpeg' };
        }

        if (buffer.slice(0, 4).equals(gif_signature)) {
            return { valid: true, format: 'gif' };
        }

        return { valid: false, format: null };
    }

    /**
     * Validate audio format
     * @param {Buffer} buffer - Audio buffer
     * @returns {Object} Validation result
     */
    validate_audio(buffer) {
        // Check magic bytes for common audio formats
        const mp3_signature = Buffer.from([0x49, 0x44, 0x33]); // ID3
        const wav_signature = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF
        const ogg_signature = Buffer.from([0x4f, 0x67, 0x67, 0x53]); // OggS

        if (buffer.slice(0, 3).equals(mp3_signature)) {
            return { valid: true, format: 'mp3' };
        }

        if (buffer.slice(0, 4).equals(wav_signature)) {
            return { valid: true, format: 'wav' };
        }

        if (buffer.slice(0, 4).equals(ogg_signature)) {
            return { valid: true, format: 'ogg' };
        }

        return { valid: false, format: null };
    }

    /**
     * Cleanup old cache entries
     * @private
     */
    _cleanup_cache() {
        const max_age = 3600000; // 1 hour
        const now = Date.now();

        for (const [key, value] of this.attachment_cache.entries()) {
            if (now - value.timestamp > max_age) {
                this.attachment_cache.delete(key);
            }
        }
    }

    /**
     * Clear attachment cache
     * @returns {void}
     */
    clear_cache() {
        this.attachment_cache.clear();
        this.cdn_cache.clear();
        logger.info('Attachment cache cleared');
    }
}

module.exports = AttachmentService;
