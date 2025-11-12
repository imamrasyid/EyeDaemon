const { BaseCommand } = require('../../base/BaseCommand');
const { PermissionFlagsBits } = require('discord.js');

module.exports = class PurgeCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'purge',
      description: 'Menghapus sejumlah pesan terakhir.',
      category: 'moderation',
      usage: 'purge <jumlah 1-100>',
      args: true,
      minArgs: 1,
      permissions: [PermissionFlagsBits.ManageMessages],
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const count = parseInt(args[0]);
    if (!Number.isFinite(count) || count < 1 || count > 100) return message.reply(this.formatError('Masukkan jumlah 1-100.'));
    const msgs = await message.channel.bulkDelete(count, true).catch(() => null);
    await message.channel.send({ embeds: [{ color: 0xe17055, title: '🧹 Purge', description: `Menghapus ${msgs?.size || 0} pesan.`, timestamp: new Date() }] });
  }
};

