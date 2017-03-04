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
    constructor(io, id) {
        this.io = io;
        this.id = id;
        this.clients = new Set();
        this.videoInformation = {};
        this.isVideoPlaying = false;
        this.videoHost = null;
        this.syncTimer = null;
        this.lastSyncTime = 0;
    }

    /**
     * Handle a client connect when the socket is started.
     *
     * @param {Object} client - socket.io client object
     */
    handleConnect(client) {
        this.clients.add(client);

        // player events
        client.on('queuevideo', video => this.queueVideo(client, video));
        client.on('updatevideo', information => this.stateChanged(client, information));
        //client.on('updateplaybackrate', rate => player.playbackRateChanged(client, rate));
        client.on('syncvideo', information => this.sync(client, information));

        // if there's already a video playing, send the new user all the relevant information
        if (this.isVideoPlaying) {
            client.emit('startvideo', this.videoInformation);
            console.log(`sent new user current video information.`);
        }

        // TODO: if we connected to a room which only has the video host connected and the room is hibernating
        // start the sync interval timers and get out of hibernation mode
    }

    /**
     * Reset the player
     *
     */
    handleDisconnect(client) {
        // remove player events
        client.removeAllListeners('startvideo');
        client.removeAllListeners('updatevideo');
        client.removeAllListeners('syncvideo');

        // remove the client
        this.clients.delete(client);

        // is there no one left in the room?
        if (this.clients.size === 0) {
            this.videoInformation = {};
            this.isVideoPlaying = false;
            this.videoHost = null;
            this.lastSyncTime = 0;

            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = null;
            }

            console.log(`no clients remaining in room '${this.id}'. cleaned up.`);
        }

        // TODO: if the only client remaining is the host of the video, go into hibernation mode
        // which will stop all sync interval timers and save a tiny amount of CPU
    }

    /**
     * Queue a video for all clients
     *
     * @param {Object} client - the client socket who sent the request
     * @param {Object} video - video information object
     */
    queueVideo(client, video) {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        this.videoInformation = Object.assign({}, video, {time: 0, state: -1, rate: 1});
        this.isVideoPlaying = true;
        this.videoHost = client;

        this.io.emit('queuevideo', this.videoInformation);
        console.log(`Video changing to "${this.videoInformation.title}"..`);

        this.syncTimer = setInterval(() => {
            if (this.videoHost !== null) {
                const sockets = this.io.sockets.sockets;
                let clients = Object.keys(sockets).filter(key => this.videoHost.id !== key);
                clients.forEach(client => {
                    sockets[client].emit('syncvideo', {
                        time: this.videoInformation.time,
                        pong: this.lastSyncTime
                    });

                    console.log(`sync time ${this.videoInformation.time} to client ${sockets[client].id}`);
                });
            }
        }, 5000);
    }

    /**
     * Fires a state changed event for all clients
     *
     * @param {Object} client - the client socket who sent the request
     * @param {Object} information - information object containing player state and current time
     */
    stateChanged(client, information) {
        // TODO: allow any client to skip etc, but don't keep sending state updates for everyone!
        // or we'll waste a tonne of bandwidth.
        if (this.videoHost === client) {
            this.videoInformation.time = information.time;
            this.videoInformation.state = information.state;
            console.log(`state changed to ${information.state}, duration: ${information.time}`);
            client.broadcast.emit('updatevideo', information);
        }
    }

    /**
     * Changes current video playback rate for all clients
     *
     * @param {Object} client - the client socket who sent the request
     * @param {float} rate - the new rate of the video playback
     */
    playbackRateChanged(client, rate) {
        if (this.videoHost === client) {
            this.videoInformation = Object.assign({}, this.videoInformation, {rate: rate});
            client.broadcast.emit('updateplaybackrate', rate);
        }
    }

    /**
     * Syncs the hosts current video time for all clients
     *
     * @param {Object} client - the client socket who sent the request
     * @param {Object} information - object containing video timestamp & ping
     */
    sync(client, information) {
        if (this.videoHost === client) {
            this.videoInformation.time = information.time;
            this.lastSyncTime = information.ping;
        }
    }
}

module.exports = Player;
