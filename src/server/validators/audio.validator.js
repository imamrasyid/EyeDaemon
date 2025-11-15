const Joi = require("joi");

/**
 * Validation schema for /stream endpoint
 * Validates query, start position, and audio filter parameters
 */
const streamSchema = Joi.object({
    query: Joi.string()
        .required()
        .trim()
        .min(1)
        .max(500)
        .pattern(/^[^;&|$><`]+$/)
        .messages({
            "string.empty": "Query is required",
            "string.base": "Query must be a string",
            "string.min": "Query cannot be empty",
            "string.max": "Query is too long (maximum 500 characters)",
            "string.pattern.base": "Query contains invalid characters (;&|$><` are not allowed)",
            "any.required": "Query parameter is required",
        }),

    start: Joi.number()
        .integer()
        .min(0)
        .max(86400) // 24 hours max
        .default(0)
        .messages({
            "number.base": "Start must be a number",
            "number.integer": "Start must be an integer",
            "number.min": "Start must be a positive number",
            "number.max": "Start position is too large (maximum 86400 seconds / 24 hours)",
        }),

    filter: Joi.string()
        .valid(
            "none",
            "bassboost",
            "nightcore",
            "vaporwave",
            "8d",
            "karaoke"
        )
        .pattern(/^(pitch|speed):\d+(\.\d+)?$/)
        .default("none")
        .messages({
            "any.only": "Invalid filter preset. Valid options: none, bassboost, nightcore, vaporwave, 8d, karaoke, pitch:X, speed:X",
            "string.base": "Filter must be a string",
        }),
});

/**
 * Validation schema for /info endpoint
 * Validates query parameter for metadata fetching
 */
const metadataSchema = Joi.object({
    query: Joi.string()
        .required()
        .trim()
        .min(1)
        .max(500)
        .pattern(/^[^;&|$><`]+$/)
        .messages({
            "string.empty": "Query is required",
            "string.base": "Query must be a string",
            "string.min": "Query cannot be empty",
            "string.max": "Query is too long (maximum 500 characters)",
            "string.pattern.base": "Query contains invalid characters (;&|$><` are not allowed)",
            "any.required": "Query parameter is required",
        }),
});

module.exports = {
    streamSchema,
    metadataSchema,
};
