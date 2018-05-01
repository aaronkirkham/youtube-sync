"use strict";

const Video = require('./video');

class Room {
  constructor(parent, id) {
    this.parent = parent;
    this.id = id;
    this.host = null;
    this.clients = new Set();
    this.playing = null;
    this.queue = [];
    this.clock = { timer: null, resolution: 5000 };
  }

  /**
   * Main clock callback, used to send ticks to clients in the room
   */
  clockTick() {
    // if we have only 1 client in the room, stop the clock
    if (this.clients.size === 1) {
      console.log(`we only have 1 client reminaing. stopping the clock.`);
      clearInterval(this.clock.timer);
      this.clock.timer = null;
    }
    // is the current video still playing?
    else if (this.playing && this.playing.state === 1) {
      const clients = Array.from(this.clients).filter(c => c !== this.host);
      clients.forEach(c => c.emit('recv', { type: 'video--clock', id: this.playing.id, time: this.playing.current_time, timestamp: this.playing.clock_time }));
    }
  }

  /**
   * Handle a client connection
   */
  connect(client) {
    if (this.clients.size === 0) {
      this.host = client;
      this.host.emit('recv', { type: 'im_the_host' });
    }
    // start the clock if we need to
    else if (!this.clock.timer) {
      console.log('started the clock');
      this.clock.timer = setInterval(this.clockTick.bind(this), this.clock.resolution);
    }

    // add the client to the room
    this.clients.add(client);

    // register the socket events
    this.on(client, 'queue--add', data => this.queueAdd(client, data));
    this.on(client, 'queue--remove', data => this.queueRemove(client, data));
    this.on(client, 'queue--order', data => this.queueOrder(client, data));
    this.on(client, 'video--change', data => this.changeVideo(client, data));
    this.on(client, 'video--update', data => this.updateVideo(client, data));
    this.on(client, 'video--playback-rate', data => this.updateVideoPlaybackRate(client, data));
    this.on(client, 'video--clock', data => this.updateClock(client, data));

    // send the current room state to the client
    const update_room_info = { playing: this.playing ? this.playing.extdata() : null, queue: [] };
    this.queue.forEach(video => update_room_info.queue.push(video.data()));
    client.emit('recv', { type: 'room--update', ...update_room_info });
  }

  /**
   * Handle a client disconnecting
   */
  disconnect(client) {
    // remove all the event listeners
    for (const event in client._events) {
      client.removeListener(event, client._events[event]);
    }

    // remove the client from the room
    this.clients.delete(client);

    // find a new host if we need to
    if (client === this.host && this.clients.size !== 0) {
      this.host = this.clients[Symbol.iterator]().next().value;
      this.host.emit('recv', { type: 'im_the_host' });
    }

    // stop the clock if we need to
    if (this.clients.size < 2 && this.clock.timer) {
      clearInterval(this.clock.timer);
      this.clock.timer = null;
    }
  }

  /**
   * Add a video to the current queue
   */
  queueAdd(client, data) {
    console.log(`queue video "${data.title}"..`);

    const video = new Video(data);

    // do we already have a video playing?
    if (this.playing) {
      this.queue.push(video);
      this.parent.io.emit('recv', { type: 'queue--add', ...video.data() });
    }
    else {
      this.playing = video;
      this.parent.io.emit('recv', { type: 'video--play', ...video.data() });
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
        this.parent.io.emit('recv', { type: 'queue--remove', id: removed[0].id });

        console.log(`Removed "${removed[0].title}" from the queue.`);
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

    const clients = Array.from(this.clients).filter(c => c !== client);
    clients.forEach(c => c.emit('recv', { type: 'queue--order', order: data.order }));
  }

  /**
   * Change a video
   */
  changeVideo(client, data) {
    // TODO: PERMISSIONS

    // this.queue.forEach(video => {
    //   if (video.id === data.id) {
    //     this.queue.delete(video);

    //     this.playing = video;
    //     this.parent.io.emit('recv', { type: 'queue--remove', id: video.id });
    //     this.parent.io.emit('recv', { type: 'video--play', ...video.data() });
    //   }
    // });

    // TODO: we don't use this function.
    throw new Error("Not implemented");

    // try find the video in the queue
    const index = this.queue.findIndex(video => video.id === data.id);
    if (index !== -1) {
      console.log(`changeVideo - found video at ${index}!`);

      const video = this.queue[index];
      console.log(video);

      this.playing = video;
      this.parent.io.emit('recv', { type: 'video--play', ...video.data() });

      // remove the video from the queue
      this.queueRemove(client, data);
    }
  }

  /**
   * Update video
   */
  updateVideo(client, data) {
    // if (client !== this.host) {
    //   return;
    // }

    if (this.playing) {
      this.playing.setState(data.state);

      console.log('updateVideo', data.state);

      switch (data.state) {
        // YT.PlayerState.PLAYING
        case 1: {
          this.playing.setTime(data.time, data.timestamp);
          console.log('PLAY VIDEO');
          break;
        }

        // YT.PlayerState.PAUSED
        case 2: {
          this.playing.setTime(data.time, Date.now());
          console.log('PAUSE VIDEO');
          break;
        }

        // YT.PlayerState.ENDED
        case 0: {
          this.playing.setTime(0, 0);
          this.playing.setPlaybackRate(1);

          this.nextVideo(client);
          break;
        }
      }

      // update the clients immediately
      Array.from(this.clients).filter(c => c !== this.host).forEach(client => {
        client.emit('recv', { type: 'video--state', id: this.playing.id, state: this.playing.state });
        client.emit('recv', { type: 'video--clock', id: this.playing.id, time: data.time, timestamp: data.timestamp });
      });
    }
  }

  /**
   * Update video playback rate
   */
  updateVideoPlaybackRate(client, data) {
    // if (client !== this.host) {
    //   return;
    // }

    if (this.playing) {
      this.playing.setPlaybackRate(data.rate);

      //console.log('set current video playback rate to:', data.rate);
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
      this.parent.io.emit('recv', { type: 'video--play', ...next.data() });

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
    if (client !== this.host) {
      return;
    }

    // update the clock for the current video
    if (this.playing && this.playing.id === data.id) {
      this.playing.setTime(data.time, data.timestamp);
    }
  }

  /**
   * Helper function to register events for clients
   */
  on(client, event, cb) {
    return client.on(`client__${event}`, cb);
  }
};

module.exports = Room;