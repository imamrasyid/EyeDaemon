/**
 * Custom Error Classes
 * Hierarchy of error types for consistent error handling
 */

/**
 * Base application error class
 * All custom errors should extend this class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation error for invalid input
 */
class ValidationError extends AppError {
    constructor(message, details = {}) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

/**
 * Not found error for missing resources
 */
class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404, 'NOT_FOUND');
    }
}

/**
 * Service error for business logic failures
 */
class ServiceError extends AppError {
    constructor(message) {
        super(message, 500, 'SERVICE_ERROR');
    }
}

/**
 * Provider error for external service failures
 */
class ProviderError extends AppError {
    constructor(message) {
        super(message, 502, 'PROVIDER_ERROR');
    }
}

/**
 * Timeout error for operations that exceed time limits
 */
class TimeoutError extends AppError {
    constructor(message) {
        super(message, 504, 'TIMEOUT');
    }
}

/**
 * Rate limit error for too many requests
 */
class RateLimitError extends AppError {
    constructor(message) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    ServiceError,
    ProviderError,
    TimeoutError,
    RateLimitError,
};
