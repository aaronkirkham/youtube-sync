"use strict";

class Video {
  constructor({ video_id, title, thumbnail }) {
    this.id = Date.now();
    this.video_id = video_id;
    this.title = title;
    this.thumbnail = thumbnail;
    this.state = 0;
    this.current_time = 0;
    this.playback_rate = 1;
    this.clock_time = 0;
  }

  data() {
    return { id: this.id, video_id: this.video_id, title: this.title, thumbnail: this.thumbnail };
  }

  extdata() {
    return { state: this.state, time: this.current_time, rate: this.playback_rate, timestamp: this.clock_time, ...this.data() };
  }

  setState(state) { this.state = state; }
  setCurrentTime(time) { this.current_time = time; }
  setPlaybackRate(rate) { this.playback_rate = rate; }
  setClockTime(time) { this.clock_time = time; }
};

class Room {
  constructor(parent, id) {
    this.parent = parent;
    this.id = id;
    this.host = null;
    this.clients = new Set();
    this.playing = null;
    this.queue = new Set();
    this.clock = { timer: null, resolution: 5000 };
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

      this.clock.timer = setInterval(() => {
        // stop the clock if we only have 1 client remaining
        if (this.clients.size === 1) {
          console.log('stopped the clock.');

          // TODO: this causes some desync when the clock is created again!
          clearInterval(this.clock.timer);
          this.clock.timer = null;
          return;
        }
        
        // YT.PlayerState.PLAYING
        if (this.playing && this.playing.state === 1) {
          this.clients.forEach(client => {
            if (client !== this.host) {
              client.emit('recv', { type: 'video--clock', id: this.playing.id, time: this.playing.current_time, timestamp: this.playing.clock_time });
            }
          });
        }
      }, this.clock.resolution);
    }

    this.clients.add(client);

    // register the socket events
    this.on(client, 'queue--add', data => this.queueVideo(client, data));
    this.on(client, 'queue--remove', data => this.unqueueVideo(client, data));
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
  }

  /**
   * Queue a video
   */
  queueVideo(client, data) {
    console.log(`queue video "${data.title}"..`);

    const video = new Video(data);

    // do we already have a video playing?
    if (this.playing) {
      this.queue.add(video);
      this.parent.io.emit('recv', { type: 'queue--add', ...video.data() });
    }
    else {
      this.playing = video;
      this.parent.io.emit('recv', { type: 'video--play', ...video.data() });
    }
  }

  /**
   * Unqueue a video
   */
  unqueueVideo(client, data) {
    // TODO: PERMISSIONS

    this.queue.forEach(video => {
      if (video.id === data.id) {
        this.queue.delete(video);
        this.parent.io.emit('recv', { type: 'queue--remove', id: video.id });
      }
    });
  }

  /**
   * Change a video
   */
  changeVideo(client, data) {
    // TODO: PERMISSIONS

    this.queue.forEach(video => {
      if (video.id === data.id) {
        this.queue.delete(video);

        this.playing = video;
        this.parent.io.emit('recv', { type: 'queue--remove', id: video.id });
        this.parent.io.emit('recv', { type: 'video--play', ...video.data() });
      }
    });
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
          this.playing.setCurrentTime(data.time);
          this.playing.setClockTime(data.timestamp);

          console.log('PLAY VIDEO');

          break;
        }

        // YT.PlayerState.PAUSED
        case 2: {
          this.playing.setCurrentTime(data.time);
          this.playing.setClockTime(Date.now());

          console.log('PAUSE VIDEO');

          break;
        }

        // YT.PlayerState.ENDED
        case 0: {
          this.playing.setCurrentTime(0);
          this.playing.setClockTime(0);
          this.playing.setPlaybackRate(1);

          this.nextVideo(client);
          break;
        }
      }

      // update the clients immediately
      this.clients.forEach(client => {
        if (client !== this.host) {
          client.emit('recv', { type: 'video--state', id: this.playing.id, state: this.playing.state });
          client.emit('recv', { type: 'video--clock', id: this.playing.id, time: data.time, timestamp: data.timestamp });
        }
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

    // find the next video to play and send it to the clients
    if (this.queue.size !== 0) {
      const next = this.queue[Symbol.iterator]().next().value;
      this.queue.delete(next);

      this.playing = next;
      this.parent.io.emit('recv', { type: 'queue--remove', id: next.id });
      this.parent.io.emit('recv', { type: 'video--play', ...next.data() });
    }
  }

  /**
   * Clock to keep everything in sync
   */
  updateClock(client, data) {
    if (client !== this.host) {
      return;
    }

    if (this.playing && this.playing.id === data.id) {
      //console.log('updateClock', data.time, data.timestamp);

      this.playing.setCurrentTime(data.time);
      this.playing.setClockTime(data.timestamp);
    }
    else {
      console.warn('got a clock update for a different video', data.id, this.playing.id);
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