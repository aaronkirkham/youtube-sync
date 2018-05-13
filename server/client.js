"use strict";

const clc = require('cli-color');

class Client {
  constructor(socket) {
    socket._client = this;
    this.socket = socket;
  }

  /**
   * Helper function to register callback to a client
   * @param {string} event event name
   * @param {function} cb callback
   */
  on(event, cb) {
    return this.socket.on(`client__${event}`, cb);
  }

  /**
   * Helper function to remove all event listeners from a client
   */
  offAll() {
    for (const event in this.socket._events) {
      this.socket.removeListener(event, this.socket._events[event]);
    }
  }

  /**
   * Send packet to client
   * @param {string} identifier the packet type identifier
   * @param {object} data data to send to the client
   */
  send(identifier, data = {}) {
    return this.socket.emit('recv', { type: identifier, ...data });
  }
}

module.exports = Client;