/**
 * AudioService
 * 
 * Service for handling audio streaming from YouTube with optional ffmpeg processing.
 * Manages stream lifecycle, cleanup, and applies audio filters.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
const BaseService = require('./base.service');
const { ServiceError } = require('../utils/errors');

class AudioService extends BaseService {
    /**
     * Create a new AudioService
     * @param {Object} config - Configuration object
     * @param {Object} dependencies - Dependencies (ytdlpProvider, ffmpegProvider)
     */
    constructor(config, dependencies) {
        super(config, dependencies);
        this.ytdlpProvider = dependencies.ytdlpProvider;
        this.ffmpegProvider = dependencies.ffmpegProvider;
    }

    /**
     * Stream audio to response with optional processing
     * @param {Object} params - Streaming parameters
     * @param {string} params.query - Search query or URL
     * @param {number} params.start - Start position in seconds
     * @param {string} params.filter - Audio filter preset
     * @param {Object} params.response - Express response object
     * @param {string} params.format - Output format (webm, mp3)
     * @returns {Promise<void>}
     */
    async streamAudio({ query, start = 0, filter = 'none', response, format = 'webm' }) {
        const startTime = Date.now();

        this.log('info', 'Starting audio stream', { query, start, filter, format });

        try {
            // Sanitize input
            const sanitizedQuery = this.sanitizeQuery(query);

            // Set response headers
            response.setHeader('Content-Type', `audio/${format}`);
            response.setHeader('Transfer-Encoding', 'chunked');
            response.setHeader('Cache-Control', 'no-store');

            // Get audio stream from yt-dlp
            const ytdlpStream = await this.ytdlpProvider.getAudioStream(sanitizedQuery);

            // Check if ffmpeg processing is needed
            const needsProcessing = start > 0 || filter !== 'none' || format !== 'webm';

            if (needsProcessing) {
                // Process with ffmpeg
                const processedStream = await this.ffmpegProvider.processAudio({
                    inputStream: ytdlpStream,
                    start,
                    filter,
                    format,
                });

                processedStream.pipe(response);

                // Setup cleanup handlers
                this.setupStreamCleanup(processedStream, ytdlpStream, response);
            } else {
                // Direct stream without processing
                ytdlpStream.pipe(response);

                this.setupStreamCleanup(ytdlpStream, null, response);
            }

            const duration = Date.now() - startTime;
            this.log('info', 'Audio stream started successfully', { query, duration });
        } catch (error) {
            this.handleError(error, 'streamAudio');
        }
    }

    /**
     * Sanitize query string to prevent command injection
     * @param {string} query - Raw query string
     * @returns {string} Sanitized query
     */
    sanitizeQuery(query) {
        // Remove dangerous characters that could be used for command injection
        return query.replace(/[;&|$><`]/g, '').trim();
    }

    /**
     * Setup stream cleanup handlers
     * @param {Stream} primaryStream - Main stream to cleanup
     * @param {Stream|null} secondaryStream - Secondary stream to cleanup (optional)
     * @param {Object} response - Express response object
     */
    setupStreamCleanup(primaryStream, secondaryStream, response) {
        const cleanup = () => {
            if (primaryStream && !primaryStream.destroyed) {
                primaryStream.destroy();
                this.log('debug', 'Primary stream destroyed');
            }
            if (secondaryStream && !secondaryStream.destroyed) {
                secondaryStream.destroy();
                this.log('debug', 'Secondary stream destroyed');
            }
        };

        // Cleanup on response events
        response.on('close', () => {
            this.log('debug', 'Response closed, cleaning up streams');
            cleanup();
        });

        response.on('error', (error) => {
            this.log('error', 'Response error, cleaning up streams', { error: error.message });
            cleanup();
        });

        // Cleanup on stream errors
        primaryStream.on('error', (error) => {
            this.log('error', 'Primary stream error', { error: error.message });
            cleanup();
        });

        if (secondaryStream) {
            secondaryStream.on('error', (error) => {
                this.log('error', 'Secondary stream error', { error: error.message });
                cleanup();
            });
        }
    }
}

module.exports = AudioService;
