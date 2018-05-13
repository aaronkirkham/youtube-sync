"use strict";

const Video = require('./video');
const Client = require('./client');
const clc = require('cli-color');

class Room {
  constructor(server, id) {
    this.server = server;
    this.id = id;
    this.host = null;
    this.clients = new Set();
    this.playing = null;
    this.queue = [];
  }

  /**
   * Handle a client connection
   */
  connect(client) {
    if (this.clients.size === 0) {
      this.host = client;
      this.host.send('im_the_host');
    }

    // add the client to the room
    this.clients.add(client);

    // register the socket events
    client.on('queue--add', data => this.queueAdd(client, data));
    client.on('queue--remove', data => this.queueRemove(client, data));
    client.on('queue--order', data => this.queueOrder(client, data));
    client.on('video--change', data => this.changeVideo(client, data));
    client.on('video--update', data => this.updateVideo(client, data));
    client.on('video--playback-rate', data => this.updateVideoPlaybackRate(client, data));
    client.on('video--clock', data => this.updateClock(client, data));

    // send the current room state to the client
    if (this.playing || this.queue.length > 0) {
      const update_room_info = { playing: this.playing ? this.playing.fullData() : null, queue: [] };
      this.queue.forEach(video => update_room_info.queue.push(video.data()));
      client.send('room--update', update_room_info);

      // TODO: need to keep track of how long ago the last player time was synced
      // so if a user joins right after the last sync, they won't be 2500ms behind the current player time
      // time += (Math.abs(Date.now() - last_sync_time) / 1000);
    }
  }

  /**
   * Handle a client disconnecting
   */
  disconnect(client) {
    // remove all the event listeners
    client.offAll();

    // remove the client from the room
    this.clients.delete(client);

    // find a new host if we need to
    if (client === this.host && this.clients.size !== 0) {
      this.host = this.clients[Symbol.iterator]().next().value;
      this.host.send('im_the_host');
    }
  }

  /**
   * Add a video to the current queue
   */
  queueAdd(client, data) {
    const video = new Video(data);

    // do we already have a video playing?
    if (this.playing) {
      this.queue.push(video);
      this.emit('queue--add', video.data());
    }
    else {
      this.playing = video;
      this.emit('video--play', video.data());
    }
  }

  /**
   * Remove a video from the current queue
   */
  queueRemove(client, data) {
    // TODO: PERMISSIONS

    // try find the video in the queue
    const index = this.queue.findIndex(video => video.id === data.id);
    if (index !== -1) {
      // remove the video from the queue
      const removed = this.queue.splice(index, 1);
      if (removed.length !== 0) {
        this.emit('queue--remove', { id: removed[0].id });
      }
    }
  }

  /**
   * Change the order of the current queue
   */
  queueOrder(client, data) {
    this.queue.sort((a, b) => {
      return data.order.indexOf(a.id) > data.order.indexOf(b.id) ? 1 : -1;
    });

    this.emit('queue--order', { order: data.order }, client);
  }

  /**
   * Change a video
   */
  changeVideo(client, data) {
    // TODO: we don't use this function.
    throw new Error("Not implemented");

    // try find the video in the queue
    // const index = this.queue.findIndex(video => video.id === data.id);
    // if (index !== -1) {
    //   console.log(`changeVideo - found video at ${index}!`);

    //   const video = this.queue[index];
    //   console.log(video);

    //   this.playing = video;
    //   this.emit('video--play', video.data());

    //   // remove the video from the queue
    //   this.queueRemove(client, data);
    // }
  }

  /**
   * Update video
   */
  updateVideo(client, data) {
    if (this.playing) {
      this.playing.setState(data.state);

      switch (data.state) {
        // YT.PlayerState.PLAYING
        case 1: {
          this.playing.setTime(data.time);
          break;
        }

        // YT.PlayerState.PAUSED
        case 2: {
          this.playing.setTime(data.time);
          break;
        }

        // YT.PlayerState.ENDED
        case 0: {
          this.playing.setTime(0);
          this.playing.setPlaybackRate(1);

          this.nextVideo(client);
          break;
        }
      }

      // if the video didn't end, update the clients immediately
      if (data.state !== 0) {
        this.emit('video--state', { id: this.playing.id, state: this.playing.state, time: this.playing.time }, client);
      }
    }
  }

  /**
   * Update video playback rate
   */
  updateVideoPlaybackRate(client, data) {
    if (this.playing) {
      this.playing.setPlaybackRate(data.rate);
      this.emit('video--playback-rate', { id: this.playing.id, rate: this.playing.playback_rate }, client);
    }
  }

  /**
   * Goto the next queued video
   */
  nextVideo(client) {
    if (client !== this.host) {
      return;
    }

    // find the next video to play from the queue
    if (this.queue.length !== 0) {
      const next = this.queue[Symbol.iterator]().next().value;

      // play the next video
      this.playing = next;
      this.emit('video--play', next.data());

      // remove the next video from the queue
      this.queueRemove(client, { id: next.id });
    }
    else {
      console.log('playlist finished!');
    }
  }

  /**
   * Clock to keep everything in sync
   */
  updateClock(client, data) {
    if (client !== this.host || !this.playing) {
      return;
    }

    if (this.playing.id === data.id) {
      this.playing.setTime(data.time);
      this.emit('video--clock', this.playing.clockData(), client);
    }
    else {
      console.log(clc.red(`Got clock update for a different video. For: ${data.id}, Current: ${this.playing.id}`));
    }
  }

  /**
   * Send packet to all clients in the room
   * @param {string} identifier the packet type identifier
   * @param {object} data data to send to the client
   * @param {Client} ignore client to not send the packet to
   */
  emit(identifier, data = {}, ignore = null) {
    const clients = ignore ? Array.from(this.clients).filter(c => c !== ignore) : this.clients;
    clients.forEach(client => client.send(identifier, data));
  }
};

module.exports = Room;