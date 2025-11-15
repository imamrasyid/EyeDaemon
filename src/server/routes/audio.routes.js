/**
 * Audio Routes
 * 
 * Defines routes for audio streaming and metadata endpoints.
 * Applies validation and async error handling.
 * 
 * Requirements: 1.1, 1.2
 */
const express = require('express');
const router = express.Router();
const asyncHandler = require('../middlewares/async-handler');
const validate = require('../middlewares/validator');
const { streamSchema, metadataSchema } = require('../validators/audio.validator');

/**
 * Create audio routes with controller
 * @param {AudioController} audioController - Audio controller instance
 * @returns {Router} Express router with audio routes
 */
module.exports = (audioController) => {
    /**
     * GET /stream
     * Stream audio with optional filters and start position
     * Query params: query (required), start (optional), filter (optional)
     */
    router.get(
        '/stream',
        validate(streamSchema),
        asyncHandler((req, res, next) => audioController.stream(req, res, next))
    );

    /**
     * GET /metadata
     * Get metadata for a track
     * Query params: query (required)
     */
    router.get(
        '/metadata',
        validate(metadataSchema),
        asyncHandler((req, res, next) => audioController.getMetadata(req, res, next))
    );

    return router;
};
