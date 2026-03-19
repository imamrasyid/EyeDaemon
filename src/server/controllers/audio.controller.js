/**
 * AudioController
 * 
 * Controller for handling audio streaming and metadata endpoints.
 * Manages HTTP request/response for audio operations.
 * 
 * Requirements: 1.3, 8.3
 */
const BaseController = require('./base.controller');

class AudioController extends BaseController {
    /**
     * Create a new AudioController
     * @param {Object} services - Services to inject (audioService, metadataService)
     */
    constructor(services) {
        super(services);
    }

    /**
     * Handle audio streaming endpoint
     * GET /stream?query=<search>&start=<seconds>&filter=<preset>
     * 
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {Function} next - Express next middleware function
     */
    async stream(req, res, next) {
        try {
            const { query, start = 0, filter = 'none' } = req.query;

            const audioService = this.getService('audioService');
            const metadataService = this.getService('metadataService');

            // Try to get cached streamUrl to avoid a second yt-dlp spawn
            const cached = metadataService.getFromCache(query);
            const streamUrl = cached?.streamUrl || null;

            await audioService.streamAudio({
                query,
                streamUrl,
                start: Number(start),
                filter,
                response: res,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handle metadata fetching endpoint
     * GET /metadata?query=<search>
     * 
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {Function} next - Express next middleware function
     */
    async getMetadata(req, res, next) {
        try {
            const { query } = req.query;

            const metadataService = this.getService('metadataService');
            const metadata = await metadataService.getTrackInfo(query);

            // Return metadata directly without wrapper for backward compatibility
            return res.json(metadata);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AudioController;
