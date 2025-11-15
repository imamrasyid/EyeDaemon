/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass them to error middleware
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        // Execute the async function and catch any errors
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = asyncHandler;
