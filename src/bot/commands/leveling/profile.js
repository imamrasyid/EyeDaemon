const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class ProfileCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'profile',
      description: 'Menampilkan statistik pengguna (leveling).',
      category: 'leveling',
      usage: 'profile [@user]',
      cooldown: 3000
    });
  }

  async execute(message) {
    const db = this.client.database;
    const target = message.mentions.users.first() || message.author;
    const guildId = message.guild.id;
    const row = await db.get('SELECT l.xp, l.level, l.total_messages, l.voice_time FROM leveling l JOIN members m ON l.member_id = m.id WHERE m.user_id = ? AND m.guild_id = ?', [target.id, guildId]);
    if (!row) return message.reply(this.formatError('Belum ada data leveling.'));
    await message.reply({ embeds: [{ color: 0x2ecc71, title: `Profil ${target.tag}`, fields: [{ name: 'Level', value: `${row.level}`, inline: true }, { name: 'XP', value: `${row.xp}`, inline: true }, { name: 'Pesan', value: `${row.total_messages}`, inline: true }, { name: 'Voice (menit)', value: `${Math.floor((row.voice_time || 0) / 60)}`, inline: true }], timestamp: new Date() }] });
  }
};

