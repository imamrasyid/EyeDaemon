const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class WithdrawCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'withdraw',
      description: 'Menarik koin dari bank ke dompet.',
      category: 'economy',
      usage: 'withdraw <amount>',
      args: true,
      minArgs: 1,
      cooldown: 3000
    });
  }

  async execute(message, args) {
    const amount = parseInt(args[0]);
    if (!Number.isFinite(amount) || amount <= 0) return message.reply(this.formatError('Jumlah tidak valid.'));
    const db = this.client.database;
    const guildId = message.guild.id;
    const userId = message.author.id;
    const member = await db.get('SELECT id FROM members WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    if (!member) return message.reply(this.formatError('Akun belum tersedia. Gunakan perintah ekonomi terlebih dahulu.'));
    const bal = await db.get('SELECT bank_balance FROM economy WHERE member_id = ?', [member.id]);
    if ((bal?.bank_balance || 0) < amount) return message.reply(this.formatError('Saldo bank tidak mencukupi.'));
    await db.query('UPDATE economy SET bank_balance = bank_balance - ?, balance = balance + ? WHERE member_id = ?', [amount, amount, member.id]);
    await message.reply(this.formatSuccess(`Menarik ${amount} koin ke dompet.`));
  }
};

