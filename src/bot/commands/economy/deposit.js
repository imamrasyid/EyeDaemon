const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class DepositCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'deposit',
      description: 'Memindahkan koin dari dompet ke bank.',
      category: 'economy',
      usage: 'deposit <amount>',
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
    const bal = await db.get('SELECT balance FROM economy WHERE member_id = ?', [member.id]);
    if ((bal?.balance || 0) < amount) return message.reply(this.formatError('Saldo tidak mencukupi.'));
    await db.query('UPDATE economy SET balance = balance - ?, bank_balance = bank_balance + ? WHERE member_id = ?', [amount, amount, member.id]);
    await message.reply(this.formatSuccess(`Deposit ${amount} koin ke bank.`));
  }
};

