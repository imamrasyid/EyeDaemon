const { BaseCommand } = require('../../base/BaseCommand');
const { seekTo } = require('../../services/player');

module.exports = class SeekCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'seek',
      description: 'Melompat ke waktu tertentu pada lagu.',
      category: 'music',
      usage: 'seek <mm:ss | detik>',
      args: true,
      minArgs: 1,
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const arg = args[0];
    let ms = 0;
    if (/^\d+$/.test(arg)) ms = parseInt(arg) * 1000;
    else {
      const parts = arg.split(':').map(x => parseInt(x));
      if (parts.length === 2 && parts.every(Number.isFinite)) ms = (parts[0] * 60 + parts[1]) * 1000;
    }
    if (!ms || ms < 0) return message.reply(this.formatError('Format waktu tidak valid.')); 
    await seekTo(message, ms);
  }
};

