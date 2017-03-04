/**
 * YouTube Player Sync
 *
 * index.js
 * Starts socket.io server on port 8080 and waits for connections.
 *
 * @author Aaron Kirkham
 * @version 1.0
 */

'use strict';

const io = require('socket.io')();
const player = require('./player');

class Server {
    constructor(io) {
        this.io = io;
        this.players = {};

        io.on('connection', client => {
            // room events
            client.on('joinroom', roomId => this.join(client, roomId));

            // socket events
            client.on('disconnect', () => this.leave(client));
        });

        // listen
        io.listen(8080);
        console.log('listening on port 8080.');
    }

    /**
     * Handle a client joining a new room
     *
     * @param {Object} client - socket.io client object
     * @param {string} id - id of the player to join
     */
    join(client, id) {
        let joiningRoom = null;

        // does the room already exist?
        const rooms = Object.keys(this.players).filter(playerId => playerId === id);
        if (rooms.length > 0) {
            joiningRoom = this.players[rooms[0]];
        }

        // if we can't find that room, create it
        if (joiningRoom === null) {
            joiningRoom = new player(this.io, id);

            this.players = Object.assign({}, this.players, {
                [id]: joiningRoom
            });
        }

        if (client !== null)
            joiningRoom.handleConnect(client);
    }

    /**
     * Handle a client leaving the server
     *
     * @param {Object} client - socket.io client object
     * @param {string} roomId - name of the room to join
     */
    leave(client) {
        Object.keys(this.players).forEach(id => {
            if (this.players[id].clients.has(client)) {
                this.players[id].handleDisconnect(client);
            }
        });
    }
}

const server = new Server(io);
