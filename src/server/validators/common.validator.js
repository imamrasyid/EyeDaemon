const Joi = require("joi");

/**
 * Common validation rules that can be reused across different schemas
 */

/**
 * Safe string validation - prevents command injection
 * Blocks dangerous characters: ; & | $ > < ` 
 */
const safeString = Joi.string()
    .trim()
    .pattern(/^[^;&|$><`]+$/)
    .messages({
        "string.pattern.base": "Input contains invalid characters (;&|$><` are not allowed)",
    });

/**
 * Query string validation with length limits
 */
const queryString = safeString
    .min(1)
    .max(500)
    .messages({
        "string.empty": "Query cannot be empty",
        "string.min": "Query cannot be empty",
        "string.max": "Query is too long (maximum 500 characters)",
    });

/**
 * Positive integer validation
 */
const positiveInteger = Joi.number()
    .integer()
    .min(0)
    .messages({
        "number.base": "Value must be a number",
        "number.integer": "Value must be an integer",
        "number.min": "Value must be a positive number",
    });

/**
 * Time duration validation (in seconds)
 * Max 24 hours (86400 seconds)
 */
const timeDuration = positiveInteger
    .max(86400)
    .messages({
        "number.max": "Duration is too large (maximum 86400 seconds / 24 hours)",
    });

/**
 * Audio filter preset validation
 * Supports predefined presets and dynamic filters (pitch:X, speed:X)
 */
const audioFilter = Joi.alternatives()
    .try(
        Joi.string().valid(
            "none",
            "bassboost",
            "nightcore",
            "vaporwave",
            "8d",
            "karaoke"
        ),
        Joi.string().pattern(/^pitch:\d+(\.\d+)?$/),
        Joi.string().pattern(/^speed:\d+(\.\d+)?$/)
    )
    .messages({
        "alternatives.match": "Invalid filter. Valid options: none, bassboost, nightcore, vaporwave, 8d, karaoke, pitch:X, speed:X",
    });

/**
 * URL validation for YouTube URLs
 */
const youtubeUrl = Joi.string()
    .uri()
    .pattern(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//)
    .messages({
        "string.uri": "Invalid URL format",
        "string.pattern.base": "URL must be a valid YouTube URL",
    });

/**
 * Pagination validation
 */
const pagination = Joi.object({
    page: positiveInteger.default(1).messages({
        "number.base": "Page must be a number",
    }),
    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(10)
        .messages({
            "number.base": "Limit must be a number",
            "number.min": "Limit must be at least 1",
            "number.max": "Limit cannot exceed 100",
        }),
});

/**
 * Correlation ID validation (UUID v4)
 */
const correlationId = Joi.string()
    .uuid({ version: "uuidv4" })
    .messages({
        "string.guid": "Invalid correlation ID format",
    });

module.exports = {
    safeString,
    queryString,
    positiveInteger,
    timeDuration,
    audioFilter,
    youtubeUrl,
    pagination,
    correlationId,
};
