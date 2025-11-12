const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class InfractionsCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'infractions',
      description: 'Menampilkan daftar peringatan pengguna.',
      category: 'moderation',
      usage: 'infractions [@user]',
      cooldown: 2000
    });
  }

  async execute(message) {
    const target = message.mentions.users.first() || message.author;
    const db = this.client.database;
    const row = await db.get('SELECT id FROM members WHERE user_id = ? AND guild_id = ?', [target.id, message.guild.id]);
    if (!row) return message.reply(this.formatError('Belum ada data untuk pengguna ini.'));
    const list = await db.all('SELECT reason, created_at, warned_by FROM warnings WHERE member_id = ? ORDER BY created_at DESC LIMIT 10', [row.id]).catch(() => []);
    if (!list || list.length === 0) return message.reply(this.formatSuccess('Tidak ada peringatan.'));
    const lines = list.map((w, i) => `${i + 1}. ${w.reason} — oleh <@${w.warned_by}>`).join('\n');
    await message.reply({ embeds: [{ color: 0xe67e22, title: `Peringatan ${target.tag}`, description: lines, timestamp: new Date() }] });
  }
};

