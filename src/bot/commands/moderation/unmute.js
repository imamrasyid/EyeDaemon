const { BaseCommand } = require('../../base/BaseCommand');
const { PermissionFlagsBits } = require('discord.js');

module.exports = class UnmuteCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'unmute',
      description: 'Menghapus timeout dari pengguna.',
      category: 'moderation',
      usage: 'unmute <@user>',
      args: true,
      minArgs: 1,
      permissions: [PermissionFlagsBits.ModerateMembers],
      cooldown: 2000
    });
  }

  async execute(message) {
    const target = message.mentions.members.first();
    if (!target) return message.reply(this.formatError('Pengguna tidak valid.'));
    await target.timeout(null, `Unmuted by ${message.author.tag}`);
    await message.reply(this.formatSuccess(`Unmuted ${target.user.tag}.`));
  }
};

