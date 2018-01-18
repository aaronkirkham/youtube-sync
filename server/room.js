"use strict";

class Video {
  constructor({id, title, thumbnail}) {
    this.id = id;
    this.title = title;
    this.thumbnail = thumbnail;
  }

  data() {
    return { id: this.id, title: this.title, thumbnail: this.thumbnail };
  }

  setCurrentTime(time) {
  }

  setPlaybackRate(rate) {
  }
};

class Room {
  constructor(parent, id) {
    this.parent = parent;
    this.id = id;
    this.host = null;
    this.clients = new Set();
    this.playing = null;
    this.queue = new Set();
  }

  /**
   * Handle a client connection
   */
  connect(client) {
    if (this.clients.size === 0) {
      this.host = client;
      this.host.emit('recv', { type: 'im_the_host' });
    }

    this.clients.add(client);

    // register the player events
    client.on('client_queue_video', data => this.queueVideo(client, data));
    client.on('client_update_video', data => this.updateVideo(client, data));
    client.on('client_update_video_playback_rate', rate => this.updateVideoPlaybackRate(client, rate));
    client.on('client_video_ended', () => this.nextVideo(client));
  }

  /**
   * Handle a client disconnecting
   */
  disconnect(client) {
    client.removeAllListeners('client_queue_video');
    client.removeAllListeners('client_update_video');
    client.removeAllListeners('client_update_video_playback_rate');

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
      this.parent.io.emit('recv', { type: 'add_to_queue', ...video.data() });
    }
    else {
      this.playing = video;
      this.parent.io.emit('recv', { type: 'play_video', ...video.data() });
    }
  }

  /**
   * Update video
   */
  updateVideo(client, data) {
    if (client !== this.host) {
      return;
    }

    if (this.playing) {
      this.playing.setCurrentTime(data.time);

      console.log('set current video time to:', data.time);
    }
  }

  /**
   * Update video playback rate
   */
  updateVideoPlaybackRate(client, data) {
    if (client !== this.host) {
      return;
    }

    if (this.playing) {
      this.playing.setPlaybackRate(data.rate);

      console.log('set current video playback rate to:', data.rate);
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
      this.parent.io.emit('recv', { type: 'remove_from_queue', id: next.id });
      this.parent.io.emit('recv', { type: 'play_video', ...next.data() });
    }
  }
};

module.exports = Room;