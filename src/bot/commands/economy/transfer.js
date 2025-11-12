const { BaseCommand } = require('../../base/BaseCommand');
const CONFIG = require('../../config');

module.exports = class TransferCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'transfer',
      description: 'Transfer koin ke pengguna lain.',
      category: 'economy',
      usage: 'transfer <@user> <amount>',
      args: true,
      minArgs: 2,
      cooldown: 5000
    });
  }

  async execute(message, args) {
    const db = this.client.database;
    const guildId = message.guild.id;
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || !Number.isFinite(amount) || amount <= 0) return message.reply(this.formatError('Format: transfer <@user> <amount>'));
    const tax = Math.floor(amount * (CONFIG.ECONOMY.TRANSFER_TAX || 0));
    const net = amount - tax;
    const senderId = message.author.id;
    const senderMember = await db.get('SELECT id FROM members WHERE user_id = ? AND guild_id = ?', [senderId, guildId]);
    const receiverMember = await db.get('SELECT id FROM members WHERE user_id = ? AND guild_id = ?', [target.id, guildId]);
    if (!senderMember || !receiverMember) return message.reply(this.formatError('Pengguna belum memiliki akun ekonomi di server ini.'));
    const senderBal = await db.get('SELECT balance FROM economy WHERE member_id = ?', [senderMember.id]);
    if ((senderBal?.balance || 0) < amount) return message.reply(this.formatError('Saldo tidak mencukupi.'));
    await db.transaction(() => {
      db.query('UPDATE economy SET balance = balance - ? WHERE member_id = ?', [amount, senderMember.id]);
      db.query('UPDATE economy SET balance = balance + ? WHERE member_id = ?', [net, receiverMember.id]);
    });
    await message.reply({ embeds: [{ color: 0x0984e3, title: '💸 Transfer', description: `Mengirim ${amount} koin ke ${target.tag}. Pajak: ${tax}. Diterima: ${net}.`, timestamp: new Date() }] });
  }
};

