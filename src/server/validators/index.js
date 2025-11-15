/**
 * Validators Module
 * 
 * Exports all validation schemas and common validation rules
 * for use throughout the application.
 */

const { streamSchema, metadataSchema } = require("./audio.validator");
const commonValidators = require("./common.validator");

module.exports = {
    // Audio endpoint schemas
    streamSchema,
    metadataSchema,

    // Common validation rules
    ...commonValidators,
};
