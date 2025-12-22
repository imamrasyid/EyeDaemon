/**
 * Migration: 0001_initial_schema (fresh consolidated schema aligned to code usage)
 */

module.exports = {
    name: '0001_initial_schema',

    async up(db) {
        // guilds (align with legacy columns guild_id/guild_name/config while keeping extras)
        await db.query(`CREATE TABLE IF NOT EXISTS guilds (
            guild_id TEXT PRIMARY KEY,
            guild_name TEXT NOT NULL,
            config TEXT DEFAULT '{}',
            owner_id TEXT,
            icon_url TEXT,
            member_count INTEGER DEFAULT 0,
            settings JSON DEFAULT '{}',
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0,
            joined_at INTEGER DEFAULT 0,
            id TEXT UNIQUE
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_guilds_owner_id ON guilds(owner_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_guilds_joined_at ON guilds(joined_at)');

        // user_profiles
        await db.query(`CREATE TABLE IF NOT EXISTS user_profiles (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            discriminator TEXT,
            avatar_url TEXT,
            bot BOOLEAN DEFAULT FALSE,
            global_settings JSON DEFAULT '{}',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )`);

        // members (base)
        await db.query(`CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT,
            joined_at INTEGER DEFAULT 0,
            roles JSON DEFAULT '[]',
            is_active BOOLEAN DEFAULT TRUE,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id)
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_members_active ON members(guild_id, is_active)');

        // guild_members (extended)
        await db.query(`CREATE TABLE IF NOT EXISTS guild_members (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            nickname TEXT,
            roles JSON DEFAULT '[]',
            joined_at INTEGER NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            last_seen_at INTEGER,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id)
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id)');

        // economy_accounts
        await db.query(`CREATE TABLE IF NOT EXISTS economy_accounts (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            wallet_balance INTEGER DEFAULT 0,
            bank_balance INTEGER DEFAULT 0,
            total_earned INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            daily_streak INTEGER DEFAULT 0,
            last_daily_at INTEGER,
            last_work_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id)
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_economy_accounts_guild_user ON economy_accounts(guild_id, user_id)');

        // economy_transactions
        await db.query(`CREATE TABLE IF NOT EXISTS economy_transactions (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            from_user_id TEXT,
            to_user_id TEXT,
            amount INTEGER NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            metadata JSON DEFAULT '{}',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (from_user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL,
            FOREIGN KEY (to_user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_economy_tx_guild_user ON economy_transactions(guild_id, from_user_id, to_user_id)');

        // economy (legacy/simple)
        await db.query(`CREATE TABLE IF NOT EXISTS economy (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL,
            balance INTEGER DEFAULT 0,
            bank_balance INTEGER DEFAULT 0,
            daily_streak INTEGER DEFAULT 0,
            last_daily INTEGER DEFAULT 0,
            last_work INTEGER DEFAULT 0,
            inventory JSON DEFAULT '[]',
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            UNIQUE(member_id)
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_economy_member ON economy(member_id)');

        // shop_items
        await db.query(`CREATE TABLE IF NOT EXISTS shop_items (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER NOT NULL,
            item_type TEXT NOT NULL,
            item_data JSON DEFAULT '{}',
            stock INTEGER DEFAULT -1,
            is_active BOOLEAN DEFAULT TRUE,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_shop_guild ON shop_items(guild_id)');

        // user_inventories
        await db.query(`CREATE TABLE IF NOT EXISTS user_inventories (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            acquired_at INTEGER NOT NULL,
            metadata JSON DEFAULT '{}',
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id, item_id)
        )`);

        // transactions (legacy/simple)
        await db.query(`CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            from_member_id TEXT,
            to_member_id TEXT,
            amount INTEGER NOT NULL,
            type TEXT NOT NULL,
            reason TEXT,
            created_at INTEGER DEFAULT 0,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
        )`);

        // command_statistics
        await db.query(`CREATE TABLE IF NOT EXISTS command_statistics (
            id TEXT PRIMARY KEY,
            guild_id TEXT,
            user_id TEXT,
            command_name TEXT NOT NULL,
            execution_time INTEGER NOT NULL,
            success BOOLEAN DEFAULT TRUE,
            error_message TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )`);

        // error_logs
        await db.query(`CREATE TABLE IF NOT EXISTS error_logs (
            id TEXT PRIMARY KEY,
            error_type TEXT NOT NULL,
            error_message TEXT NOT NULL,
            stack_trace TEXT,
            context JSON DEFAULT '{}',
            guild_id TEXT,
            user_id TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE SET NULL,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )`);

        // event_logs
        await db.query(`CREATE TABLE IF NOT EXISTS event_logs (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            user_id TEXT,
            channel_id TEXT,
            event_data JSON NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )`);

        // message_logs (for message deletions/edits)
        await db.query(`CREATE TABLE IF NOT EXISTS message_logs (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            content TEXT,
            action TEXT NOT NULL,
            reason TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_message_logs_guild ON message_logs(guild_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_message_logs_msg ON message_logs(message_id)');

        // user_levels (new leveling model)
        await db.query(`CREATE TABLE IF NOT EXISTS user_levels (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            total_messages INTEGER DEFAULT 0,
            voice_minutes INTEGER DEFAULT 0,
            last_xp_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id)
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_levels_guild_user ON user_levels(guild_id, user_id)');

        // legacy leveling table to satisfy older code paths (uses member_id as key)
        await db.query(`CREATE TABLE IF NOT EXISTS leveling (
            member_id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            total_messages INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id)
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_leveling_guild_user ON leveling(guild_id, user_id)');

        // level_rewards
        await db.query(`CREATE TABLE IF NOT EXISTS level_rewards (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            level INTEGER NOT NULL,
            reward_type TEXT NOT NULL,
            reward_data JSON NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            UNIQUE(guild_id, level, reward_type)
        )`);

        // playlists
        await db.query(`CREATE TABLE IF NOT EXISTS music_playlists (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            is_public BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_music_playlists_guild_user ON music_playlists(guild_id, user_id)');

        await db.query(`CREATE TABLE IF NOT EXISTS music_playlist_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id TEXT NOT NULL,
            track_data TEXT NOT NULL,
            position INTEGER NOT NULL,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES music_playlists(id) ON DELETE CASCADE
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_music_playlist_tracks_playlist ON music_playlist_tracks(playlist_id)');

        // music queue (align with code expecting queue_data/current_position/filter/is_paused)
        await db.query(`CREATE TABLE IF NOT EXISTS music_queue_state (
            guild_id TEXT PRIMARY KEY,
            queue_data TEXT,
            current_position INTEGER DEFAULT 0,
            loop_mode TEXT DEFAULT 'off',
            volume INTEGER DEFAULT 80,
            filter TEXT DEFAULT 'none',
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0,
            voice_channel_id TEXT,
            text_channel_id TEXT,
            is_paused BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_music_queue_state_updated ON music_queue_state(updated_at)');

        await db.query(`CREATE TABLE IF NOT EXISTS music_queue_tracks (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            track_url TEXT NOT NULL,
            track_title TEXT NOT NULL,
            track_duration INTEGER NOT NULL,
            track_author TEXT,
            track_thumbnail TEXT,
            requested_by TEXT NOT NULL,
            position INTEGER NOT NULL,
            added_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (requested_by) REFERENCES user_profiles(user_id) ON DELETE CASCADE
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS track_metadata_cache (
            id TEXT PRIMARY KEY,
            query TEXT NOT NULL UNIQUE,
            track_url TEXT NOT NULL,
            track_title TEXT NOT NULL,
            track_duration INTEGER NOT NULL,
            track_author TEXT,
            track_thumbnail TEXT,
            source TEXT NOT NULL,
            metadata JSON DEFAULT '{}',
            hit_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_track_metadata_expires ON track_metadata_cache(expires_at)');

        // moderation
        await db.query(`CREATE TABLE IF NOT EXISTS warnings (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            warned_by TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at INTEGER DEFAULT 0,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_warnings_member ON warnings(member_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_warnings_active ON warnings(is_active)');

        await db.query(`CREATE TABLE IF NOT EXISTS moderation_logs (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            action TEXT NOT NULL,
            reason TEXT,
            duration INTEGER,
            metadata JSON DEFAULT '{}',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (moderator_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_modlogs_guild ON moderation_logs(guild_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_modlogs_target ON moderation_logs(target_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_modlogs_moderator ON moderation_logs(moderator_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_modlogs_date ON moderation_logs(created_at DESC)');

        await db.query(`CREATE TABLE IF NOT EXISTS automod_config (
            guild_id TEXT PRIMARY KEY,
            spam_detection BOOLEAN DEFAULT FALSE,
            spam_threshold INTEGER DEFAULT 5,
            word_filter_enabled BOOLEAN DEFAULT FALSE,
            filtered_words JSON DEFAULT '[]',
            link_filter_enabled BOOLEAN DEFAULT FALSE,
            allowed_domains JSON DEFAULT '[]',
            caps_filter_enabled BOOLEAN DEFAULT FALSE,
            caps_threshold INTEGER DEFAULT 70,
            emoji_filter_enabled BOOLEAN DEFAULT FALSE,
            emoji_threshold INTEGER DEFAULT 10,
            raid_protection BOOLEAN DEFAULT FALSE,
            settings JSON DEFAULT '{}',
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS moderation_config (
            guild_id TEXT PRIMARY KEY,
            enabled INTEGER DEFAULT 0,
            anti_spam INTEGER DEFAULT 1,
            anti_link INTEGER DEFAULT 0,
            anti_invite INTEGER DEFAULT 1,
            anti_mention_spam INTEGER DEFAULT 1,
            anti_caps INTEGER DEFAULT 0,
            anti_emoji_spam INTEGER DEFAULT 0,
            word_filter TEXT DEFAULT '[]',
            regex_filters TEXT DEFAULT '[]',
            spam_threshold INTEGER DEFAULT 5,
            spam_window INTEGER DEFAULT 5000,
            mention_spam_threshold INTEGER DEFAULT 5,
            caps_threshold REAL DEFAULT 0.7,
            caps_min_length INTEGER DEFAULT 10,
            emoji_spam_threshold INTEGER DEFAULT 5,
            default_action TEXT DEFAULT 'delete',
            warn_threshold INTEGER DEFAULT 2,
            kick_threshold INTEGER DEFAULT 3,
            ban_threshold INTEGER DEFAULT 5,
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS user_warnings (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            expires_at INTEGER,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            FOREIGN KEY (moderator_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )`);

        // ticketing
        await db.query(`CREATE TABLE IF NOT EXISTS ticket_categories (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            emoji TEXT,
            staff_role_ids JSON DEFAULT '[]',
            auto_response TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            UNIQUE(guild_id, name)
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL UNIQUE,
            user_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            claimed_by TEXT,
            priority TEXT DEFAULT 'normal',
            created_at INTEGER NOT NULL,
            claimed_at INTEGER,
            closed_at INTEGER,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE,
            FOREIGN KEY (claimed_by) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS ticket_messages (
            id TEXT PRIMARY KEY,
            ticket_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            content TEXT NOT NULL,
            attachments JSON DEFAULT '[]',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
        )`);

        // roles
        await db.query(`CREATE TABLE IF NOT EXISTS reaction_roles (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            emoji TEXT NOT NULL,
            role_id TEXT NOT NULL,
            description TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
            UNIQUE(message_id, emoji)
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS auto_roles (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            role_id TEXT NOT NULL,
            condition_type TEXT NOT NULL,
            condition_data JSON DEFAULT '{}',
            is_active BOOLEAN DEFAULT TRUE,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
        )`);

        // cache
        await db.query(`CREATE TABLE IF NOT EXISTS cache_entries (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at)');

        // distributed locks
        await db.query(`CREATE TABLE IF NOT EXISTS distributed_locks (
            lock_key TEXT PRIMARY KEY,
            lock_token TEXT NOT NULL,
            acquired_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            owner_id TEXT NOT NULL
        )`);
        await db.query('CREATE INDEX IF NOT EXISTS idx_locks_expires ON distributed_locks(expires_at)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_locks_owner ON distributed_locks(owner_id)');
    },

    async down(db) {
        const tables = [
            'cache_entries', 'distributed_locks',
            'auto_roles', 'reaction_roles',
            'ticket_messages', 'tickets', 'ticket_categories',
            'user_warnings', 'moderation_config', 'automod_config', 'moderation_logs', 'warnings',
            'message_logs',
            'track_metadata_cache', 'music_queue_tracks', 'music_queue_state',
            'music_playlist_tracks', 'music_playlists',
            'level_rewards', 'leveling', 'user_levels',
            'command_statistics', 'error_logs', 'event_logs',
            'user_inventories', 'shop_items',
            'economy_transactions', 'economy_accounts', 'economy',
            'transactions',
            'guild_members', 'members',
            'user_profiles', 'guilds'
        ];
        for (const tbl of tables) {
            await db.query(`DROP TABLE IF EXISTS ${tbl}`);
        }
    }
};
