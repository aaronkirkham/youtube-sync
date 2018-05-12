"use strict";

const clc = require('cli-color');

class Client {
  constructor(socket) {
    socket._client = this;
    this.socket = socket;
    this.clock = 0;

    // update the clock
    this.updateClock(socket.handshake.query.timestamp);
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
    // adjust the timestamp to compensate for the client clock
    if (typeof data.timestamp !== 'undefined') {
      console.log(data.timestamp, this.clock);
      data.timestamp = data.timestamp - this.clock;
      console.log(clc.blue(`send - timestamp=${data.timestamp}`));
    }

    console.log(data);

    return this.socket.emit('recv', { type: identifier, ...data });
  }

  /**
   * Update the clients clock correction
   * @param {integer} timestamp Unix timestamp from the client
   */
  updateClock(timestamp) {
    // check the client time doesn't differ too much from the server
    this.clock = (Date.now() - timestamp);
    if (Math.abs(this.clock) > 1000) {
      console.warn(clc.yellow(`client has a weird clock. (server=${Date.now()}, client=${timestamp}, diff=${this.clock})`));
    }
  }

  
  clockCorrected(timestamp) {
    let r = timestamp - this.clock;
    console.log('clockCorrected:', r);
    return r;
  }
}

module.exports = Client;