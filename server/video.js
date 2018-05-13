"use strict";

class Video {
  constructor({ video_id, title, thumbnail }) {
    this.id = Math.random().toString(36).substr(2, 7);
    this.video_id = video_id;
    this.title = title;
    this.thumbnail = thumbnail;
    this.state = 0;
    this.time = 0;
    this.playback_rate = 1;
  }

  /**
   * Get the current video basic data
   */
  data() {
    return { id: this.id, video_id: this.video_id, title: this.title, thumbnail: this.thumbnail };
  }

  /**
   * Get the current video full data
   */
  fullData() {
    return { ...this.data(), state: this.state, rate: this.playback_rate, time: this.time };
  }

  /**
   * Get the current video clock data
   */
  clockData() {
    return { id: this.id, time: this.time };
  }

  /**
   * Set the current video state
   * @param {integer} state The target state
   */
  setState(state) {
    this.state = state;
  }

  /**
   * Set the current video time
   * @param {float} time The target time
   */
  setTime(time) {
    this.time = time;
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