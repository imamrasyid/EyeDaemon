'use strict';

/**
 * PlaylistService
 * 
 * Service for managing music playlists.
 * Synchronized with consolidated schema:
 * - playlists (id, guild_id, user_id, name, description, public, data_json, created_at, updated_at)
 * - playlist_items (id AUTOINCREMENT, playlist_id, position, title, url, duration, requested_by, added_at)
 */

const BaseService = require('../../../../system/core/BaseService');
const { randomUUID } = require('crypto');

class PlaylistService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);
        this.MAX_TRACKS = 50;
    }

    /**
     * Create a new playlist
     */
    async createPlaylist({ userId, guildId, name, isPublic = false, description = null }) {
        this.validateRequired({ userId, guildId, name }, ['userId', 'guildId', 'name']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            if (name.length < 1 || name.length > 100) {
                throw new Error('Playlist name must be between 1 and 100 characters');
            }

            const existing = await db.query(
                `SELECT id FROM playlists WHERE user_id = ? AND guild_id = ? AND name = ?`,
                [userId, guildId, name]
            );

            if (existing && existing.length > 0) {
                throw new Error('You already have a playlist with this name');
            }

            const playlistId = randomUUID();
            const now = Math.floor(Date.now() / 1000);

            // Ensure user profile exists for FK
            await db.query(
                `INSERT INTO user_profiles (user_id, created_at, updated_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(user_id) DO NOTHING`,
                [userId, now, now]
            );

            await db.query(
                `INSERT INTO playlists (id, guild_id, user_id, name, description, public, data_json, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)`,
                [playlistId, guildId, userId, name, description, isPublic ? 1 : 0, now, now]
            );

            this.log(`Created playlist ${playlistId} for user ${userId}`, 'info');

            return {
                id: playlistId,
                guildId,
                userId,
                name,
                isPublic,
                description,
                trackCount: 0,
            };
        } catch (error) {
            throw this.handleError(error, 'createPlaylist');
        }
    }

    /**
     * Delete a playlist
     */
    async deletePlaylist(playlistId, userId) {
        this.validateRequired({ playlistId, userId }, ['playlistId', 'userId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const rows = await db.query(
                `SELECT id FROM playlists WHERE id = ? AND user_id = ?`,
                [playlistId, userId]
            );

            if (!rows || rows.length === 0) {
                throw new Error('Playlist not found or you do not own this playlist');
            }

            await db.query('DELETE FROM playlist_items WHERE playlist_id = ?', [playlistId]);
            await db.query('DELETE FROM playlists WHERE id = ?', [playlistId]);

            this.log(`Deleted playlist ${playlistId}`, 'info');
            return true;
        } catch (error) {
            throw this.handleError(error, 'deletePlaylist');
        }
    }

    /**
     * Get a playlist by ID
     */
    async getPlaylist(playlistId, userId = null) {
        this.validateRequired({ playlistId }, ['playlistId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const rows = await db.query(
                `SELECT p.*, COUNT(t.id) as track_count
                 FROM playlists p
                 LEFT JOIN playlist_items t ON p.id = t.playlist_id
                 WHERE p.id = ?
                 GROUP BY p.id`,
                [playlistId]
            );

            if (!rows || rows.length === 0) return null;

            const playlist = rows[0];

            if (userId && playlist.user_id !== userId && !playlist.public) {
                throw new Error('You do not have access to this playlist');
            }

            return {
                id: playlist.id,
                guildId: playlist.guild_id,
                userId: playlist.user_id,
                name: playlist.name,
                description: playlist.description,
                isPublic: Boolean(playlist.public),
                trackCount: playlist.track_count || 0,
                createdAt: playlist.created_at,
                updatedAt: playlist.updated_at,
            };
        } catch (error) {
            throw this.handleError(error, 'getPlaylist');
        }
    }

    /**
     * Get user playlists
     */
    async getUserPlaylists(userId, guildId) {
        this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const playlists = await db.query(
                `SELECT p.*, COUNT(t.id) as track_count
                 FROM playlists p
                 LEFT JOIN playlist_items t ON p.id = t.playlist_id
                 WHERE p.user_id = ? AND p.guild_id = ?
                 GROUP BY p.id
                 ORDER BY p.created_at DESC`,
                [userId, guildId]
            );

            return (playlists || []).map(p => ({
                id: p.id,
                guildId: p.guild_id,
                userId: p.user_id,
                name: p.name,
                description: p.description,
                isPublic: Boolean(p.public),
                trackCount: p.track_count || 0,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
            }));
        } catch (error) {
            throw this.handleError(error, 'getUserPlaylists');
        }
    }

    /**
     * Get public playlists for guild
     */
    async getPublicPlaylists(guildId, limit = 20) {
        this.validateRequired({ guildId }, ['guildId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const playlists = await db.query(
                `SELECT p.*, COUNT(t.id) as track_count
                 FROM playlists p
                 LEFT JOIN playlist_items t ON p.id = t.playlist_id
                 WHERE p.guild_id = ? AND p.public = 1
                 GROUP BY p.id
                 ORDER BY p.created_at DESC
                 LIMIT ?`,
                [guildId, limit]
            );

            return (playlists || []).map(p => ({
                id: p.id,
                guildId: p.guild_id,
                userId: p.user_id,
                name: p.name,
                description: p.description,
                isPublic: Boolean(p.public),
                trackCount: p.track_count || 0,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
            }));
        } catch (error) {
            throw this.handleError(error, 'getPublicPlaylists');
        }
    }

    /**
     * Add track to playlist
     */
    async addTrack(playlistId, userId, track) {
        this.validateRequired({ playlistId, userId, track }, ['playlistId', 'userId', 'track']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const owns = await db.query(
                `SELECT id FROM playlists WHERE id = ? AND user_id = ?`,
                [playlistId, userId]
            );

            if (!owns || owns.length === 0) {
                throw new Error('Playlist not found or you do not own this playlist');
            }

            const countRows = await db.query(
                `SELECT COUNT(*) as count FROM playlist_items WHERE playlist_id = ?`,
                [playlistId]
            );

            const count = countRows?.[0]?.count || 0;
            if (count >= this.MAX_TRACKS) {
                throw new Error(`Playlist is full! Maximum ${this.MAX_TRACKS} tracks allowed.`);
            }

            const maxPosRows = await db.query(
                `SELECT MAX(position) as max_pos FROM playlist_items WHERE playlist_id = ?`,
                [playlistId]
            );

            const position = (maxPosRows?.[0]?.max_pos || 0) + 1;
            const now = Math.floor(Date.now() / 1000);

            await db.query(
                `INSERT INTO playlist_items (playlist_id, position, title, url, duration, requested_by, added_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    playlistId,
                    position,
                    track.title || 'Unknown Title',
                    track.url || track.uri || '',
                    track.duration || 0,
                    userId,
                    now
                ]
            );

            await db.query('UPDATE playlists SET updated_at = ? WHERE id = ?', [now, playlistId]);

            this.log(`Added track to playlist ${playlistId} at position ${position}`, 'info');
            return position;
        } catch (error) {
            throw this.handleError(error, 'addTrack');
        }
    }

    /**
     * Remove track from playlist
     */
    async removeTrack(playlistId, userId, position) {
        this.validateRequired({ playlistId, userId, position }, ['playlistId', 'userId', 'position']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const owns = await db.query(
                `SELECT id FROM playlists WHERE id = ? AND user_id = ?`,
                [playlistId, userId]
            );

            if (!owns || owns.length === 0) {
                throw new Error('Playlist not found or you do not own this playlist');
            }

            const result = await db.query(
                `DELETE FROM playlist_items WHERE playlist_id = ? AND position = ?`,
                [playlistId, position]
            );

            if (!result || result.changes === 0) {
                throw new Error('Track not found at this position');
            }

            await db.query(
                `UPDATE playlist_items SET position = position - 1 WHERE playlist_id = ? AND position > ?`,
                [playlistId, position]
            );

            const now = Math.floor(Date.now() / 1000);
            await db.query('UPDATE playlists SET updated_at = ? WHERE id = ?', [now, playlistId]);

            return true;
        } catch (error) {
            throw this.handleError(error, 'removeTrack');
        }
    }

    /**
     * Load playlist tracks
     */
    async loadPlaylistTracks(playlistId, userId = null) {
        this.validateRequired({ playlistId }, ['playlistId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const rows = await db.query(
                `SELECT user_id, public FROM playlists WHERE id = ?`,
                [playlistId]
            );

            if (!rows || rows.length === 0) throw new Error('Playlist not found');

            const playlist = rows[0];
            if (userId && playlist.user_id !== userId && !playlist.public) {
                throw new Error('You do not have access to this playlist');
            }

            const tracks = await db.query(
                `SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY position ASC`,
                [playlistId]
            );

            return (tracks || []).map(t => ({
                title: t.title,
                url: t.url,
                duration: t.duration,
                position: t.position,
                requestedBy: t.requested_by,
            }));
        } catch (error) {
            throw this.handleError(error, 'loadPlaylistTracks');
        }
    }

    /**
     * Save current queue as playlist
     */
    async saveCurrentQueue({ userId, guildId, name, tracks, isPublic = false }) {
        this.validateRequired({ userId, guildId, name, tracks }, ['userId', 'guildId', 'name', 'tracks']);

        try {
            if (tracks.length === 0) throw new Error('Cannot save empty queue');
            if (tracks.length > this.MAX_TRACKS) throw new Error(`Cannot save more than ${this.MAX_TRACKS} tracks`);

            const playlist = await this.createPlaylist({ userId, guildId, name, isPublic });
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const now = Math.floor(Date.now() / 1000);

            for (let i = 0; i < tracks.length; i++) {
                const t = tracks[i];
                await db.query(
                    `INSERT INTO playlist_items (playlist_id, position, title, url, duration, requested_by, added_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        playlist.id,
                        i + 1,
                        t.title || 'Unknown Title',
                        t.url || t.uri || '',
                        t.duration || 0,
                        userId,
                        now
                    ]
                );
            }

            return {
                ...playlist,
                trackCount: tracks.length,
            };
        } catch (error) {
            throw this.handleError(error, 'saveCurrentQueue');
        }
    }

    /**
     * Update playlist settings
     */
    async updatePlaylist(playlistId, userId, updates) {
        this.validateRequired({ playlistId, userId }, ['playlistId', 'userId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const owns = await db.query(
                `SELECT id FROM playlists WHERE id = ? AND user_id = ?`,
                [playlistId, userId]
            );

            if (!owns || owns.length === 0) {
                throw new Error('Playlist not found or you do not own this playlist');
            }

            const updateFields = [];
            const values = [];

            if (updates.name !== undefined) {
                if (updates.name.length < 1 || updates.name.length > 100) {
                    throw new Error('Playlist name must be between 1 and 100 characters');
                }
                updateFields.push('name = ?');
                values.push(updates.name);
            }

            if (updates.isPublic !== undefined) {
                updateFields.push('public = ?');
                values.push(updates.isPublic ? 1 : 0);
            }

            if (updateFields.length === 0) return true;

            const now = Math.floor(Date.now() / 1000);
            updateFields.push('updated_at = ?');
            values.push(now);
            values.push(playlistId);

            await db.query(
                `UPDATE playlists SET ${updateFields.join(', ')} WHERE id = ?`,
                values
            );

            return true;
        } catch (error) {
            throw this.handleError(error, 'updatePlaylist');
        }
    }
}

module.exports = PlaylistService;
