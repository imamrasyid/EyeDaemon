/**
 * Route Aggregator
 * 
 * Combines all application routes and exports a factory function
 * that creates routes with injected controllers.
 * 
 * Requirements: 1.1, 1.2
 */
const audioRoutes = require('./audio.routes');
const healthRoutes = require('./health.routes');

/**
 * Create all application routes with controllers
 * 
 * @param {Object} controllers - Object containing all controller instances
 * @param {AudioController} controllers.audioController - Audio controller
 * @param {HealthController} controllers.healthController - Health controller
 * @returns {Object} Object containing all route routers
 */
module.exports = (controllers) => {
    return {
        audio: audioRoutes(controllers.audioController),
        health: healthRoutes(controllers.healthController),
    };
};
