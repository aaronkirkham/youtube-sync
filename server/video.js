"use strict";

class Video {
  constructor({ video_id, title, thumbnail }) {
    this.id = Math.random().toString(36).substr(2, 7);
    this.video_id = video_id;
    this.title = title;
    this.thumbnail = thumbnail;
    this.state = 0;
    this.current_time = 0;
    this.playback_rate = 1;
    this.clock_time = 0;
  }

  /**
   * Get the current video basic data
   */
  data() {
    return { id: this.id, video_id: this.video_id, title: this.title, thumbnail: this.thumbnail };
  }

  /**
   * Get the current video extra data
   */
  extdata() {
    return { state: this.state, time: this.current_time, rate: this.playback_rate, timestamp: this.clock_time, ...this.data() };
  }

  /**
   * Set the current video state
   * @param {integer} The target state
   */
  setState(state) {
    this.state = state;
  }

  /**
   * Set the current video time and clock time
   * @param {float} time The target time
   * @param {float} clock_time The target clock time
   */
  setTime(time, clock_time) {
    this.current_time = time;
    this.clock_time = clock_time;
  }

  /**
   * Set the current video playback rate
   * @param {float} rate The target playback rate
   */
  setPlaybackRate(rate) {
    this.playback_rate = rate;
  }
};

module.exports = Video;