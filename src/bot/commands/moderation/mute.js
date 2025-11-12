const { BaseCommand } = require('../../base/BaseCommand');
const { PermissionFlagsBits } = require('discord.js');

module.exports = class MuteCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'mute',
      description: 'Timeout pengguna untuk durasi tertentu.',
      category: 'moderation',
      usage: 'mute <@user> <durasi (e.g. 10m)>',
      args: true,
      minArgs: 2,
      permissions: [PermissionFlagsBits.ModerateMembers],
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const target = message.mentions.members.first();
    const timeStr = args[1];
    if (!target) return message.reply(this.formatError('Pengguna tidak valid.'));
    const ms = require('../../utils/functions').parseTime(timeStr);
    if (!ms || ms < 1000) return message.reply(this.formatError('Durasi tidak valid.'));
    await target.timeout(ms, `Muted by ${message.author.tag}`);
    await message.reply(this.formatSuccess(`Muted ${target.user.tag} selama ${timeStr}.`));
  }
};

