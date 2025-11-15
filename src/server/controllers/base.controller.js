/**
 * BaseController
 * 
 * Base class for all controllers providing common functionality:
 * - Service injection and dependency management
 * - Response helper methods
 * - Consistent error handling
 */
class BaseController {
    /**
     * Create a new BaseController
     * @param {Object} services - Services to inject into the controller
     */
    constructor(services = {}) {
        this.services = services;
    }

    /**
     * Inject or update services
     * @param {Object} services - Services to inject
     */
    setServices(services) {
        this.services = { ...this.services, ...services };
    }

    /**
     * Get a service by name
     * @param {string} name - Service name
     * @returns {Object} The requested service
     * @throws {Error} If service is not found
     */
    getService(name) {
        if (!this.services[name]) {
            throw new Error(`Service ${name} not found`);
        }
        return this.services[name];
    }

    /**
     * Send a success response
     * @param {Response} res - Express response object
     * @param {*} data - Data to send in response
     * @param {number} statusCode - HTTP status code (default: 200)
     * @returns {Response} Express response
     */
    success(res, data, statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            data,
        });
    }

    /**
     * Send an error response
     * @param {Response} res - Express response object
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code (default: 500)
     * @returns {Response} Express response
     */
    error(res, message, statusCode = 500) {
        return res.status(statusCode).json({
            success: false,
            error: message,
        });
    }
}

module.exports = BaseController;
