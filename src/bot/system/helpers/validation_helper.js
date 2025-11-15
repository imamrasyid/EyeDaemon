/**
 * Validation Helper
 * 
 * Utility functions for validating user permissions and bot state
 */

/**
 * Validate that a member is in a voice channel
 * @param {GuildMember} member - Discord guild member
 * @returns {VoiceChannel} The voice channel the member is in
 * @throws {Error} If member is not in a voice channel
 */
function validateVoiceChannel(member) {
    if (!member.voice.channel) {
        throw new Error('You must be in a voice channel!');
    }
    return member.voice.channel;
}

/**
 * Validate that the bot has required permissions in a voice channel
 * @param {VoiceChannel} voiceChannel - The voice channel to check
 * @param {Guild} guild - The Discord guild
 * @throws {Error} If bot lacks required permissions
 */
function validateBotPermissions(voiceChannel, guild) {
    const permissions = voiceChannel.permissionsFor(guild.members.me);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        throw new Error('I need permissions to join and speak in your voice channel!');
    }
}

module.exports = {
    validateVoiceChannel,
    validateBotPermissions
};
