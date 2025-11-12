const { DISCORD_MUSIC_CHANNELS, DISCORD_DJ_ROLE } = require("../config");

function checkChannel(message) {
    if (!DISCORD_MUSIC_CHANNELS.length) return true;
    return DISCORD_MUSIC_CHANNELS.includes(message.channel.id);
}

function requireDJ(member) {
    if (!DISCORD_DJ_ROLE) return true;
    return member.roles.cache.some(r => r.name === DISCORD_DJ_ROLE);
}

module.exports = { checkChannel, requireDJ };
