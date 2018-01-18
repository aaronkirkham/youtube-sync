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
    //
  }

  setPlaybackRate(rate) {
    //
  }
};

class Room {
  constructor(parent, id) {
    this.parent = parent;
    this.id = id;
    this.clients = new Set();
    this.playing = null;
    this.queue = new Set();
  }

  /**
   * Handle a client connection
   */
  connect(client) {
    this.clients.add(client);

    // register the player events
    client.on('client_queue_video', data => this.queueVideo(client, data));
    client.on('client_update_video', data => this.updateVideo(client, data));
    client.on('client_update_video_playback_rate', rate => this.updateVideoPlaybackRate(client, rate));
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
      // update queue ui for clients
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
    // TODO: permissions

    if (this.playing) {
      this.playing.setCurrentTime(data.time);

      console.log('set current video time to:', data.time);
    }
  }

  /**
   * Update video playback rate
   */
  updateVideoPlaybackRate(client, rate) {
    // TODO: permissions

    if (this.playing) {
      this.playing.setPlaybackRate(rate);

      console.log('set current video playback rate to:', rate);
    }
  }
};

module.exports = Room;