const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class EcoLeaderboardCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'ecolb',
      description: 'Menampilkan papan peringkat ekonomi.',
      category: 'economy',
      usage: 'ecolb',
      cooldown: 5000
    });
  }

  async execute(message) {
    const db = this.client.database;
    const guildId = message.guild.id;
    const rows = await db.all(
      'SELECT m.user_id, e.balance FROM economy e JOIN members m ON e.member_id = m.id WHERE m.guild_id = ? ORDER BY e.balance DESC LIMIT 10',
      [guildId]
    );
    if (!rows || rows.length === 0) return message.reply(this.formatError('Belum ada data.'));
    const lines = rows.map((r, i) => `${i + 1}. <@${r.user_id}> — ${r.balance}`).join('\n');
    await message.reply({ embeds: [{ color: 0x6c5ce7, title: '🏦 Economy Leaderboard', description: lines, timestamp: new Date() }] });
  }
};

