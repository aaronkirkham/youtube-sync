"use strict";

const Room = require('./room');

class Server {
  constructor() {
    this.io = require('socket.io')();
    this.io.listen(8888);
    this.rooms = [];

    // register the client handlers when we have a new connection
    this.io.on('connection', client => {
      client.on('room_join', id => this.join(client, id));
      client.on('disconnect', () => this.leave(client));
    });

    console.log('server is listening on port 8888..');
  }
  
  /**
   * Handle a client joining a room
   */
  join(client, id) {
    const exists = this.rooms.filter(room => room.id === id);
    if (exists.length === 0) {
      // create the room and add the client
      const room = new Room(this, id);
      room.connect(client);

      this.rooms.push(room);
    }
    // if the room already exists, join it!
    else {
      exists[0].connect(client);
    }
  }

  /**
   * Handle a client leaving a room
   */
  leave(client) {
    this.rooms.forEach(room => {
      // is the client a member of this room?
      if (room.clients.has(client)) {
        // disconnect from the room
        room.disconnect(client);
      }
    });

    // cleanup any rooms without clients now
    this.rooms = this.rooms.filter(room => room.clients.size !== 0);
  }
};

const server = new Server();