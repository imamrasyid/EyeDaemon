const { ValidationError } = require('../utils/errors');

/**
 * Validation middleware factory
 * Creates middleware that validates request data against a Joi schema
 * 
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
function validate(schema) {
    return (req, res, next) => {
        // Validate request query parameters
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,      // Collect all errors, not just the first
            stripUnknown: true,     // Remove unknown fields
            convert: true,          // Convert types (e.g., string to number)
        });

        if (error) {
            // Format validation errors into a details object
            const details = error.details.reduce((acc, detail) => {
                const field = detail.path.join('.');
                acc[field] = detail.message;
                return acc;
            }, {});

            // Throw validation error with formatted details
            return next(new ValidationError('Validation failed', details));
        }

        // Replace query with validated and sanitized values
        req.query = value;
        next();
    };
}

module.exports = validate;
