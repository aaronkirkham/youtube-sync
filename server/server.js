"use strict";

const Room = require('./room');
const Client = require('./client');
const clc = require('cli-color');

class Server {
  constructor(port = 8888) {
    this.io = require('socket.io')(port);
    this.clients = new Set();
    this.rooms = [];

    // register the client handlers when we have a new connection
    this.io.on('connection', socket => {
      const client = new Client(socket);
      this.clients.add(client);

      let room_id = null;
      let needs_url_update = false;

      // do we have a room to connect to?
      let referer = socket.handshake.headers.referer.replace(socket.handshake.headers.origin, '');
      if (referer !== '/') {
        // remove the leading slash
        room_id = referer.startsWith('/') ? referer.substr(1, referer.length) : referer;
      }
      else {
        room_id = this.findRoom();
        needs_url_update = true;
      }

      // join the room
      this.join(client, room_id);

      // if we need to update the url, send the packet
      if (needs_url_update) {
        client.send('update_url', { id: room_id });
      }

      // handle disconnect
      socket.on('disconnect', () => this.leave(client));
    });

    console.log(`server is listening on port ${port}...`);
  }
  
  /**
   * Handle a client joining a room
   */
  join(client, id) {
    const room = this.rooms.find(room => room.id === id);
    if (typeof room === 'undefined') {
      // create the room and add the client
      const new_room = new Room(this, id);
      new_room.connect(client);

      this.rooms.push(new_room);
    }
    // if the room already exists, join it!
    else {
      room.connect(client);
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

    // remove the client from the clients list
    this.clients.delete(client);

    // cleanup any rooms without clients now
    // this.rooms = this.rooms.filter(room => room.clients.size !== 0);
  }

  /**
   * Find a room id which isn't in use
   */
  findRoom() {
    const id = Math.random().toString(36).substr(2, 7);

    // do we already have a room with this id?
    const result = this.rooms.find(room => room.id === id);
    if (typeof result !== 'undefined') {
      return this.findRoom();
    }

    return id;
  }
};

const server = new Server();