/**
 * PlaylistService
 * 
 * Service for managing music playlists.
 * Handles playlist CRUD operations and track management.
 */

const BaseService = require('../../../../system/core/BaseService');
const { v4: uuidv4 } = require('uuid');

class PlaylistService extends BaseService {
    /**
     * Create a new PlaylistService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);

        // Maximum tracks per playlist
        this.MAX_TRACKS = 50;
    }

    /**
     * Create a new playlist
     * @param {Object} params - Playlist parameters
     * @param {string} params.userId - User ID
     * @param {string} params.guildId - Guild ID
     * @param {string} params.name - Playlist name
     * @param {boolean} params.isPublic - Whether playlist is public
     * @returns {Promise<Object>} Created playlist
     */
    async createPlaylist({ userId, guildId, name, isPublic = false }) {
        this.validateRequired({ userId, guildId, name }, ['userId', 'guildId', 'name']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            // Validate name length
            if (name.length < 1 || name.length > 100) {
                throw new Error('Playlist name must be between 1 and 100 characters');
            }

            // Check if user already has a playlist with this name
            const existing = db.prepare(`
                SELECT id FROM music_playlists
                WHERE user_id = ? AND guild_id = ? AND name = ?
            `).get(userId, guildId, name);

            if (existing) {
                throw new Error('You already have a playlist with this name');
            }

            // Create playlist
            const playlistId = uuidv4();
            const stmt = db.prepare(`
                INSERT INTO music_playlists (id, guild_id, user_id, name, is_public, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `);

            stmt.run(playlistId, guildId, userId, name, isPublic ? 1 : 0);

            this.log(`Created playlist ${playlistId} for user ${userId}`, 'info');

            return {
                id: playlistId,
                guildId,
                userId,
                name,
                isPublic,
                trackCount: 0,
            };
        } catch (error) {
            throw this.handleError(error, 'createPlaylist');
        }
    }

    /**
     * Delete a playlist
     * @param {string} playlistId - Playlist ID
     * @param {string} userId - User ID (for ownership check)
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deletePlaylist(playlistId, userId) {
        this.validateRequired({ playlistId, userId }, ['playlistId', 'userId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            // Check ownership
            const playlist = db.prepare(`
                SELECT id FROM music_playlists
                WHERE id = ? AND user_id = ?
            `).get(playlistId, userId);

            if (!playlist) {
                throw new Error('Playlist not found or you do not own this playlist');
            }

            // Delete playlist (tracks will be deleted by CASCADE)
            const stmt = db.prepare('DELETE FROM music_playlists WHERE id = ?');
            stmt.run(playlistId);

            this.log(`Deleted playlist ${playlistId}`, 'info');

            return true;
        } catch (error) {
            throw this.handleError(error, 'deletePlaylist');
        }
    }

    /**
     * Get a playlist by ID
     * @param {string} playlistId - Playlist ID
     * @param {string} userId - User ID (optional, for access check)
     * @returns {Promise<Object|null>} Playlist object or null
     */
    async getPlaylist(playlistId, userId = null) {
        this.validateRequired({ playlistId }, ['playlistId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            // Get playlist
            const playlist = db.prepare(`
                SELECT p.*, COUNT(t.id) as track_count
                FROM music_playlists p
                LEFT JOIN music_playlist_tracks t ON p.id = t.playlist_id
                WHERE p.id = ?
                GROUP BY p.id
            `).get(playlistId);

            if (!playlist) {
                return null;
            }

            // Check access (must be owner or public)
            if (userId && playlist.user_id !== userId && !playlist.is_public) {
                throw new Error('You do not have access to this playlist');
            }

            return {
                id: playlist.id,
                guildId: playlist.guild_id,
                userId: playlist.user_id,
                name: playlist.name,
                isPublic: Boolean(playlist.is_public),
                trackCount: playlist.track_count,
                createdAt: playlist.created_at,
                updatedAt: playlist.updated_at,
            };
        } catch (error) {
            throw this.handleError(error, 'getPlaylist');
        }
    }

    /**
     * Get user's playlists
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Array>} Array of playlists
     */
    async getUserPlaylists(userId, guildId) {
        this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const playlists = db.prepare(`
                SELECT p.*, COUNT(t.id) as track_count
                FROM music_playlists p
                LEFT JOIN music_playlist_tracks t ON p.id = t.playlist_id
                WHERE p.user_id = ? AND p.guild_id = ?
                GROUP BY p.id
                ORDER BY p.created_at DESC
            `).all(userId, guildId);

            // Ensure playlists is always an array
            if (!Array.isArray(playlists)) {
                this.log('Database query returned non-array result, returning empty array', 'warn');
                return [];
            }

            return playlists.map(p => ({
                id: p.id,
                guildId: p.guild_id,
                userId: p.user_id,
                name: p.name,
                isPublic: Boolean(p.is_public),
                trackCount: p.track_count,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
            }));
        } catch (error) {
            throw this.handleError(error, 'getUserPlaylists');
        }
    }

    /**
     * Get public playlists for a guild
     * @param {string} guildId - Guild ID
     * @param {number} limit - Maximum number of playlists to return
     * @returns {Promise<Array>} Array of public playlists
     */
    async getPublicPlaylists(guildId, limit = 20) {
        this.validateRequired({ guildId }, ['guildId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const playlists = db.prepare(`
                SELECT p.*, COUNT(t.id) as track_count
                FROM music_playlists p
                LEFT JOIN music_playlist_tracks t ON p.id = t.playlist_id
                WHERE p.guild_id = ? AND p.is_public = 1
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT ?
            `).all(guildId, limit);

            // Ensure playlists is always an array
            if (!Array.isArray(playlists)) {
                this.log('Database query returned non-array result, returning empty array', 'warn');
                return [];
            }

            return playlists.map(p => ({
                id: p.id,
                guildId: p.guild_id,
                userId: p.user_id,
                name: p.name,
                isPublic: Boolean(p.is_public),
                trackCount: p.track_count,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
            }));
        } catch (error) {
            throw this.handleError(error, 'getPublicPlaylists');
        }
    }

    /**
     * Add track to playlist
     * @param {string} playlistId - Playlist ID
     * @param {string} userId - User ID (for ownership check)
     * @param {Object} track - Track object
     * @returns {Promise<number>} Position of added track
     */
    async addTrack(playlistId, userId, track) {
        this.validateRequired({ playlistId, userId, track }, ['playlistId', 'userId', 'track']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            // Check ownership
            const playlist = db.prepare(`
                SELECT id FROM music_playlists
                WHERE id = ? AND user_id = ?
            `).get(playlistId, userId);

            if (!playlist) {
                throw new Error('Playlist not found or you do not own this playlist');
            }

            // Check track count
            const trackCount = db.prepare(`
                SELECT COUNT(*) as count FROM music_playlist_tracks
                WHERE playlist_id = ?
            `).get(playlistId);

            if (trackCount.count >= this.MAX_TRACKS) {
                throw new Error(`Playlist is full! Maximum ${this.MAX_TRACKS} tracks allowed.`);
            }

            // Get next position
            const maxPosition = db.prepare(`
                SELECT MAX(position) as max_pos FROM music_playlist_tracks
                WHERE playlist_id = ?
            `).get(playlistId);

            const position = (maxPosition.max_pos || 0) + 1;

            // Add track
            const stmt = db.prepare(`
                INSERT INTO music_playlist_tracks (playlist_id, track_data, position, added_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `);

            stmt.run(playlistId, JSON.stringify(track), position);

            // Update playlist updated_at
            db.prepare('UPDATE music_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(playlistId);

            this.log(`Added track to playlist ${playlistId} at position ${position}`, 'info');

            return position;
        } catch (error) {
            throw this.handleError(error, 'addTrack');
        }
    }

    /**
     * Remove track from playlist
     * @param {string} playlistId - Playlist ID
     * @param {string} userId - User ID (for ownership check)
     * @param {number} position - Track position (1-based)
     * @returns {Promise<boolean>} True if removed successfully
     */
    async removeTrack(playlistId, userId, position) {
        this.validateRequired({ playlistId, userId, position }, ['playlistId', 'userId', 'position']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            // Check ownership
            const playlist = db.prepare(`
                SELECT id FROM music_playlists
                WHERE id = ? AND user_id = ?
            `).get(playlistId, userId);

            if (!playlist) {
                throw new Error('Playlist not found or you do not own this playlist');
            }

            // Delete track
            const stmt = db.prepare(`
                DELETE FROM music_playlist_tracks
                WHERE playlist_id = ? AND position = ?
            `);

            const result = stmt.run(playlistId, position);

            if (result.changes === 0) {
                throw new Error('Track not found at this position');
            }

            // Reorder remaining tracks
            db.prepare(`
                UPDATE music_playlist_tracks
                SET position = position - 1
                WHERE playlist_id = ? AND position > ?
            `).run(playlistId, position);

            // Update playlist updated_at
            db.prepare('UPDATE music_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(playlistId);

            this.log(`Removed track from playlist ${playlistId} at position ${position}`, 'info');

            return true;
        } catch (error) {
            throw this.handleError(error, 'removeTrack');
        }
    }

    /**
     * Get tracks from playlist
     * @param {string} playlistId - Playlist ID
     * @param {string} userId - User ID (optional, for access check)
     * @returns {Promise<Array>} Array of tracks
     */
    async loadPlaylistTracks(playlistId, userId = null) {
        this.validateRequired({ playlistId }, ['playlistId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            // Check access
            const playlist = db.prepare(`
                SELECT user_id, is_public FROM music_playlists
                WHERE id = ?
            `).get(playlistId);

            if (!playlist) {
                throw new Error('Playlist not found');
            }

            // Check access (must be owner or public)
            if (userId && playlist.user_id !== userId && !playlist.is_public) {
                throw new Error('You do not have access to this playlist');
            }

            // Get tracks
            const tracks = db.prepare(`
                SELECT track_data, position
                FROM music_playlist_tracks
                WHERE playlist_id = ?
                ORDER BY position ASC
            `).all(playlistId);

            return tracks.map(t => ({
                ...JSON.parse(t.track_data),
                position: t.position,
            }));
        } catch (error) {
            throw this.handleError(error, 'loadPlaylistTracks');
        }
    }

    /**
     * Save current queue as playlist
     * @param {Object} params - Save parameters
     * @param {string} params.userId - User ID
     * @param {string} params.guildId - Guild ID
     * @param {string} params.name - Playlist name
     * @param {Array} params.tracks - Array of tracks
     * @param {boolean} params.isPublic - Whether playlist is public
     * @returns {Promise<Object>} Created playlist
     */
    async saveCurrentQueue({ userId, guildId, name, tracks, isPublic = false }) {
        this.validateRequired({ userId, guildId, name, tracks }, ['userId', 'guildId', 'name', 'tracks']);

        try {
            // Validate track count
            if (tracks.length === 0) {
                throw new Error('Cannot save empty queue');
            }

            if (tracks.length > this.MAX_TRACKS) {
                throw new Error(`Cannot save more than ${this.MAX_TRACKS} tracks`);
            }

            // Create playlist
            const playlist = await this.createPlaylist({ userId, guildId, name, isPublic });

            // Add tracks
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            const stmt = db.prepare(`
                INSERT INTO music_playlist_tracks (playlist_id, track_data, position, added_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `);

            for (let i = 0; i < tracks.length; i++) {
                stmt.run(playlist.id, JSON.stringify(tracks[i]), i + 1);
            }

            this.log(`Saved ${tracks.length} tracks to playlist ${playlist.id}`, 'info');

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
     * @param {string} playlistId - Playlist ID
     * @param {string} userId - User ID (for ownership check)
     * @param {Object} updates - Updates to apply
     * @param {string} updates.name - New name (optional)
     * @param {boolean} updates.isPublic - New public status (optional)
     * @returns {Promise<boolean>} True if updated successfully
     */
    async updatePlaylist(playlistId, userId, updates) {
        this.validateRequired({ playlistId, userId }, ['playlistId', 'userId']);

        try {
            const db = this.getDatabase();
            if (!db) throw new Error('Database not available');

            // Check ownership
            const playlist = db.prepare(`
                SELECT id FROM music_playlists
                WHERE id = ? AND user_id = ?
            `).get(playlistId, userId);

            if (!playlist) {
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
                updateFields.push('is_public = ?');
                values.push(updates.isPublic ? 1 : 0);
            }

            if (updateFields.length === 0) {
                return true; // Nothing to update
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(playlistId);

            const stmt = db.prepare(`
                UPDATE music_playlists
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `);

            stmt.run(...values);

            this.log(`Updated playlist ${playlistId}`, 'info');

            return true;
        } catch (error) {
            throw this.handleError(error, 'updatePlaylist');
        }
    }
}

module.exports = PlaylistService;
