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
const player = new (require('./player'))(io);

io.on('connection', client => {
    // Handle the connection with the player incase there's already stuff going on
    player.handleConnect(client);

    // Player events
    client.on('queuevideo', video => player.queueVideo(client, video));
    client.on('updatevideo', information => player.stateChanged(client, information));
    client.on('updateplaybackrate', rate => player.playbackRateChanged(client, rate));

    // Socket events
    client.on('disconnect', () => player.handleDisconnect());
});

// listen
io.listen(8080);
console.log('listening on port 8080.');