require('dotenv').config();

module.exports.config = {
    port: Number(process.env.AUDIO_SOURCE_PORT || 3000),
    ffmpegPath: require('ffmpeg-static'),
};
