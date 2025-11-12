const { BaseCommand } = require('../../base/BaseCommand');
const { PermissionFlagsBits } = require('discord.js');

module.exports = class SlowmodeCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'slowmode',
      description: 'Mengatur slowmode pada channel.',
      category: 'moderation',
      usage: 'slowmode <detik 0-21600>',
      args: true,
      minArgs: 1,
      permissions: [PermissionFlagsBits.ManageChannels],
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const seconds = parseInt(args[0]);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 21600) return message.reply(this.formatError('Masukkan detik 0-21600.'));
    await message.channel.setRateLimitPerUser(seconds).catch(() => {});
    await message.reply(this.formatSuccess(`Slowmode disetel ke ${seconds}s.`));
  }
};

