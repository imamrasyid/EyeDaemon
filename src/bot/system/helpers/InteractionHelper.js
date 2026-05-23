/**
 * Interaction Helper
 * 
 * Provides utility functions for handling Discord interactions with proper API usage.
 */

const { MessageFlags } = require('discord.js');

/**
 * Reply to an interaction with ephemeral message
 * @param {Object} interaction - Discord interaction
 * @param {string|Object} content - Message content or options object
 * @returns {Promise<void>}
 */
async function replyEphemeral(interaction, content) {
    const options = typeof content === 'string'
        ? { content, flags: MessageFlags.Ephemeral }
        : { ...content, flags: MessageFlags.Ephemeral };

    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply(options);
    } else {
        return await interaction.reply(options);
    }
}

/**
 * Reply to an interaction with public message
 * @param {Object} interaction - Discord interaction
 * @param {string|Object} content - Message content or options object
 * @returns {Promise<void>}
 */
async function replyPublic(interaction, content) {
    const options = typeof content === 'string'
        ? { content }
        : content;

    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply(options);
    } else {
        return await interaction.reply(options);
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
    replyEphemeral,
    replyPublic,
    deferEphemeral,
    deferPublic,
    sendError,
    sendSuccess,
    MessageFlags
};
