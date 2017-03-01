/**
 * YouTube Player Sync
 * 
 * player.js
 * Main class for YouTube player data storage
 *
 * @author Aaron Kirkham
 * @version 1.0
 */

'use strict';

class Player {
    constructor(io) {
        this.io = io;
        this.videoInformation = {};
        this.isVideoPlaying = false;
    }

    /**
     * Handle a client connect when the socket is started.
     *
     * @param {Object} client - socket.io client object
     */
    handleConnect(client) {
        // if there's already a video playing, send the new user all the relevant information
        if (this.isVideoPlaying) {
            client.emit('startvideo', this.videoInformation);
            console.log(`sent new user current video information.`);
        }
    }

    /**
     * Handle a client disconnect.
     *
     */
    handleDisconnect() {
        // if there are no users remaining, reset everything
        if (this.io.engine.clientsCount === 0) {
            this.videoInformation = {};
            this.isVideoPlaying = false;

            console.log(`no clients remaining. cleaned up.`);
        }
    }

    /**
     * Queue a video for all connected clients
     *
     * @param {Object} video - video information object
     */
    queueVideo(video) {
        this.videoInformation = video;
        this.videoInformation['time'] = 0;
        this.isVideoPlaying = true;

        this.io.emit('queuevideo', this.videoInformation);
        console.log(`Video changing to "${this.videoInformation.title}"..`);
    }
}

module.exports = Player;