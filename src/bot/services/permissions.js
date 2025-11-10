const { allowedChannels, djRole } = require("../config");

function checkChannel(message) {
    if (!allowedChannels.length) return true;
    return allowedChannels.includes(message.channel.id);
}

function requireDJ(member) {
    if (!djRole) return true;
    return member.roles.cache.some(r => r.name === djRole);
}

module.exports = { checkChannel, requireDJ };
