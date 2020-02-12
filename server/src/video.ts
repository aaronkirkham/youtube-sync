import { getRandomString } from './util.js';

interface VideoConstructorObj {
  id: string;
  title: string;
  thumbnail: string;
}

export class Video {
  readonly id: string;
  private readonly videoId: string;
  private readonly title: string;
  private readonly thumbnail: string;
  private state: number = -1;
  private time: number = 0;
  private playbackRate: number = 1;
  private lastSyncTime: number = 0;

  constructor({ id, title, thumbnail }: VideoConstructorObj) {
    this.id = getRandomString(7);
    this.videoId = id;
    this.title = title;
    this.thumbnail = thumbnail;
  }

  /**
   * Get basic information about the video
   * (id, videoId, title, thumbnail)
   */
  data(): object {
    return {
      id: this.id,
      videoId: this.videoId,
      title: this.title,
      thumbnail: this.thumbnail,
    };
  }

  /**
   * Get detailed information about the video
   * (id, videoId, title, thumbnail, state, time, playbackRate)
   */
  fullData(): object {
    return {
      ...this.data(),
      state: this.state,
      time: this.getTime(),
      rate: this.playbackRate,
    };
  }

  /**
   * Get basic information about the video state
   * (id, state, time)
   */
  stateData(): object {
    return {
      id: this.id,
      state: this.state,
      time: this.getTime(),
    };
  }

  /**
   * Get basic information about the video playback rate
   * (id, rate)
   */
  rateData(): object {
    return {
      id: this.id,
      rate: this.playbackRate,
    };
  }

  /**
   * Get clock information about the video
   * (id, time)
   */
  clockData(): object {
    return {
      id: this.id,
      time: this.getTime(),
    };
  }

  /**
   * Set the video state
   * @param state Target video state (see YT.PlayerState)
   */
  setState(state: number): void {
    this.state = state;
  }

  /**
   * Set the video time
   * @param time Target video time
   */
  setTime(time: number): void {
    this.time = time;
    this.lastSyncTime = Date.now();
  }

  /**
   * Get the extrapolated video time
   */
  getTime(): number {
    // if the current video is not playing (YT.PlayerState.PLAYING) return the current
    // time without extrapolation
    if (this.state !== 1) {
      return this.time;
    }

    // figure out how long has elapsed since the last clock update
    return (this.time + (Math.abs(Date.now() - this.lastSyncTime) / 1000));
  }

  /**
   * Set the video playback rate
   * @param rate Target playback rate
   */
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
  }

  /**
   * Getter to test if the video has ended
   */
  hasEnded(): boolean {
    return this.state === 0;
  }
}
