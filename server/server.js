"use strict";

const Room = require('./room');

class Server {
  constructor() {
    this.io = require('socket.io')();
    this.io.listen(8888);
    this.rooms = [];

    // register the client handlers when we have a new connection
    this.io.on('connection', client => {
      let room_id = null;
      let needs_url_update = false;

      // TODO: update this for the vue-router stuff

      // do we have a room to connect to?
      let referer = client.handshake.headers.referer;
      if (referer.includes('/?')) {
        const query_params = this.splitQueryParams(referer.substr(referer.indexOf('/?') + 2, referer.length));
        room_id = query_params['room'];
      }
      else {
        room_id = this.findRoom();
        needs_url_update = true;
      }

      // join the room
      this.join(client, room_id);

      // if we need to update the url, send the packet
      if (needs_url_update) {
        client.emit('recv', { type: 'update_url', id: room_id });
      }

      //client.on('room_join', id => this.join(client, id));
      client.on('disconnect', () => this.leave(client));
    });

    console.log('server is listening on port 8888..');
  }
  
  /**
   * Handle a client joining a room
   */
  join(client, id) {
    const room = this.rooms.find(room => room.id === id);
    if (typeof room === "undefined") {
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
    if (typeof result !== "undefined") {
      return this.findRoom();
    }

    return id;
  }

  /**
   * Helper function to split URL query params into an object
   */
  splitQueryParams(str) {
    const res = {};
    const parts = str.split('&');
  
    parts.forEach(part => {
      const s = part.split('=');
      res[s[0]] = s[1];
    });
  
    return res;
  }
};

const server = new Server();