/**
 * Express Application Factory
 * 
 * Creates and configures the Express application with all middleware,
 * routes, and error handling.
 * 
 * Requirements: 1.1, 9.1, 9.2, 9.3, 9.4
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const requestLogger = require('./middlewares/request-logger');
const errorHandler = require('./middlewares/error-handler');
const createRateLimiter = require('./middlewares/rate-limiter');
const timeout = require('./middlewares/timeout');

/**
 * Create and configure Express application
 * 
 * @param {Object} routes - Object containing all route routers
 * @param {Router} routes.health - Health check routes
 * @param {Router} routes.audio - Audio streaming routes
 * @returns {Express} Configured Express application
 */
function createApp(routes) {
    const app = express();

    // Security middleware
    // Note: helmet is optional - install with: npm install helmet
    try {
        const helmet = require('helmet');
        app.use(helmet());
    } catch (err) {
        // helmet not installed, skip
    }

    // CORS configuration
    app.use(cors(config.get('cors')));

    // Body parsing
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    if (config.get('env') === 'development') {
        app.use(morgan('dev'));
    }
    app.use(requestLogger);

    // Rate limiting
    app.use(createRateLimiter(config));

    // Request timeout
    app.use(timeout(config.get('requestTimeout')));

    // Pretty JSON in development
    if (config.get('env') === 'development') {
        app.set('json spaces', 2);
    }

    // Mount routes
    app.use('/', routes.health);
    app.use('/api/audio', routes.audio);

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            code: 'NOT_FOUND',
        });
    });

    // Error handler (must be last)
    app.use(errorHandler);

    return app;
}

module.exports = createApp;
