/**
 * Health Routes
 * 
 * Defines routes for health check and monitoring endpoints.
 * Applies async error handling.
 * 
 * Requirements: 7.1
 */
const express = require('express');
const router = express.Router();
const asyncHandler = require('../middlewares/async-handler');

/**
 * Create health routes with controller
 * @param {HealthController} healthController - Health controller instance
 * @returns {Router} Express router with health routes
 */
module.exports = (healthController) => {
    /**
     * GET /health
     * Check application health and dependency availability
     * Returns health status, uptime, and dependency checks
     */
    router.get(
        '/health',
        asyncHandler((req, res, next) => healthController.check(req, res, next))
    );

    return router;
};
