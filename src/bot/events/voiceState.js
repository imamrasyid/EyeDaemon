const { BaseDiscordEvent } = require('../base/BaseEvent');
const { getState, scheduleIdleCleanup } = require('../services/player');

class VoiceStateEvent extends BaseDiscordEvent {
  constructor(client) {
    super(client, {
      name: 'voiceState',
      eventName: 'voiceStateUpdate',
      description: 'Handle auto-leave when voice channel idle'
    });
  }

  async execute(oldState, newState) {
    const ch = oldState.channel || newState.channel;
    if (!ch) return;
    const gid = ch.guild.id;
    const s = getState(gid);
    if (!s.connection) return;
    const nonBots = ch.members.filter(m => !m.user.bot);
    if (nonBots.size === 0) {
      scheduleIdleCleanup(gid, ch, s.now || s.queue?.[0]);
    } else {
      if (s.idleTimer) {
        clearTimeout(s.idleTimer);
        s.idleTimer = null;
      }
    }
  }
}

module.exports = VoiceStateEvent;
