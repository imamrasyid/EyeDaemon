/**
 * Interaction Helper
 * 
 * Provides utility functions for handling Discord interactions with proper API usage.
 */

const { MessageFlags } = require('discord.js');

/**
 * Check if an interaction has expired (cannot be replied to)
 * @param {Object} interaction - Discord interaction
 * @returns {boolean} True if interaction is too old to respond
 */
function isInteractionExpired(interaction) {
    const creationTime = interaction.createdTimestamp;
    const now = Date.now();
    const ELIGIBLE_MS = 14 * 60 * 1000;
    return (now - creationTime) > ELIGIBLE_MS;
}

/**
 * Reply to an interaction with ephemeral message
 * @param {Object} interaction - Discord interaction
 * @param {string|Object} content - Message content or options object
 * @returns {Promise<void>}
 */
async function replyEphemeral(interaction, content) {
    if (isInteractionExpired(interaction)) return;

    const options = typeof content === 'string'
        ? { content, flags: MessageFlags.Ephemeral }
        : { ...content, flags: MessageFlags.Ephemeral };

    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.editReply(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        if (error.code === 10062 || error.code === 50013) return;
        throw error;
    }
}

/**
 * Reply to an interaction with public message
 * @param {Object} interaction - Discord interaction
 * @param {string|Object} content - Message content or options object
 * @returns {Promise<void>}
 */
async function replyPublic(interaction, content) {
    if (isInteractionExpired(interaction)) return;

    const options = typeof content === 'string'
        ? { content }
        : content;

    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.editReply(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        if (error.code === 10062 || error.code === 50013) return;
        throw error;
    }
}

/**
 * Defer reply with ephemeral flag
 * @param {Object} interaction - Discord interaction
 * @returns {Promise<void>}
 */
async function deferEphemeral(interaction) {
    return await interaction.deferReply({ flags: MessageFlags.Ephemeral });
}

/**
 * Defer reply with public flag
 * @param {Object} interaction - Discord interaction
 * @returns {Promise<void>}
 */
async function deferPublic(interaction) {
    return await interaction.deferReply();
}

/**
 * Send error message to interaction
 * @param {Object} interaction - Discord interaction
 * @param {string} message - Error message
 * @returns {Promise<void>}
 */
async function sendError(interaction, message) {
    const errorMessage = `❌ ${message}`;
    return await replyEphemeral(interaction, errorMessage);
}

/**
 * Send success message to interaction
 * @param {Object} interaction - Discord interaction
 * @param {string} message - Success message
 * @returns {Promise<void>}
 */
async function sendSuccess(interaction, message) {
    const successMessage = `✅ ${message}`;
    return await replyPublic(interaction, successMessage);
}

module.exports = {
    isInteractionExpired,
    replyEphemeral,
    replyPublic,
    deferEphemeral,
    deferPublic,
    sendError,
    sendSuccess,
    MessageFlags
};
