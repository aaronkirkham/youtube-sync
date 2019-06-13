<template>
  <main class="player" id="player">
    <div class="player__iframe-container">
      <div id="player__iframe"></div>
    </div>
    <div class="style-input">
      <input type="text" class="input" placeholder="Paste a YouTube URL..." v-model="videoToQueue" @keyup.enter="requestVideo()" />
      <button type="submit" class="button" @click="requestVideo()">Queue</button>
    </div>
  </main>
</template>

<script>
  import Vue from 'vue';
  import store from '../store';

  const PlayerFlags = {
    Ready: 1,
    Paused: 2,
    Waiting: 4,
    Seeking: 8,
  };

  export default Vue.component('youtube-player', {
    data() {
      return {
        player: null,
        videoToQueue: 'https://www.youtube.com/watch?v=hAxSVf7zoD8',
        flags: 0,
        currentVideo: null,
        videoToPlayWhenReady: null,
        resyncClock: false,
        ignorePlayerState: true,
      };
    },
    created() {
      const script = document.createElement('script');
      script.setAttribute('async', true);
      script.setAttribute('src', 'https://youtube.com/iframe_api');
      document.head.appendChild(script);
    },
    mounted() {
      this.$root.$on('server__video--play', this.play);
      this.$root.$on('server__video--state', (data) => {
        this.ignorePlayerState = true;
        this.updateState(data);
      });
      this.$root.$on('server__video--playbackrate', ({ rate }) => this.setPlaybackRate(rate));
      this.$root.$on('server__room--update', ({ current }) => this.play(current));

      this.$root.$on('server__video--clock', (data) => {
        console.log('server__video--clock', data);

        if (this.currentVideo.id === data.id) {
          const time = this.calcNetworkPlayerTime(data.time);
          if (time !== false) {
            this.player.seekTo(time, true);
            console.log('FORCED RESYNC', time);
          }
        }
      });

      this.$root.$on('server__pong', (data) => {
        // send the clock update
        if (this.isHost && this.currentVideo && ((this.flags & PlayerFlags.Ready) && !(this.flags & PlayerFlags.Paused))) {
          this.sendVideoClockData();
        }
      });

      // youtube iframe ready
      window.onYouTubeIframeAPIReady = this.createPlayer;
    },
    methods: {
      requestVideo() {
        this.$root.$emit('queue-video', this.videoToQueue);
        this.videoToQueue = '';
      },

      /**
       * Start playing a video
       */
      play(video) {
        if (!video) {
          console.error('invalid video!');
          return;
        }

        if (this.flags & PlayerFlags.Ready) {
          let time = video.time ? video.time : 0;

          // if the video is playing, calculate the network player time
          if (video.state === 1) {
            time = this.calcNetworkPlayerTime(video.time, true);
          }

          if (typeof video.state === 'undefined') {
            video.state = -1; // unstarted
          }

          console.log(`playing video at`, time);

          this.currentVideo = video;
          this.player.loadVideoById(video.videoId, time, 'default');
          document.title = `${video.title} - YouTube Sync`;

          // set the playback rate if we need to
          if (typeof video.rate !== 'undefined') {
            console.log(`playVideo - setting video playback rate to '${video.rate}'...`);
            this.player.setPlaybackRate(video.rate);
          }
        } else {
          console.warn(`playVideo - player isn't ready yet. video will start when playing is loaded.`);
          this.videoToPlayWhenReady = video;
          this.flags |= PlayerFlags.Waiting;
        }
      },

      /**
       * Initialise YouTube player iframe
       */
      createPlayer() {
        this.player = new YT.Player('player__iframe', {
          width: 560,
          height: 315,
          playerVars: {
            'autoplay': 0, // don't start playing the media automatically
            'controls': 1, // show the player default controls
            'iv_load_policy': 3, // don't show any video annotations
            'rel': 0, // don't show any related videos
          },
          events: {
            /**
             * Player is ready
             */
            onReady: () => {
              this.flags |= PlayerFlags.Ready;

              // do we have a video waiting to play?
              if (this.flags & PlayerFlags.Waiting) {
                if (this.videoToPlayWhenReady) {
                  this.play(this.videoToPlayWhenReady);
                  this.videoToPlayWhenReady = null;
                  this.resyncClock = true;
                }

                this.flags &= ~PlayerFlags.Waiting;
              }
            },

            /**
             * Player state changed
             */
            onStateChange: (event) => {
              const state = event.data;

              // ignore buffering states
              if (state === YT.PlayerState.BUFFERING) {
                return false;
              }

              console.log(`PlayerStateChange - New State: ${state}, Old State: ${this.currentVideo.state}`);

              // once the video has started playing, force the state update if we requested it
              if (state === YT.PlayerState.PLAYING && this.currentVideo.state !== state && this.ignorePlayerState) {
                console.log(`PlayerStateChange - video is playing and ignorePlayerState flag is set. Switching to state ${this.currentVideo.state} now.`);
                this.updateState(this.currentVideo);
                return false;
              }

/*
              // is the player state where it needs to be?
              if (state === this.currentVideo.state) {
                if (this.ignorePlayerState) {
                  this.ignorePlayerState = false;
                  console.log('PlayerStateChange - player is at the target state.', state);
                }

                // TODO: send time-only update?
                // can't skip into the video when the player is paused

                return false;
              }
            

              // dont send the important stuff if we don't want to
              if (this.ignorePlayerState) {
                return false;
              }
*/

              // update the currentVideo video state
              this.currentVideo.state = state;

              // playing - send update and remove the paused flag
              if (state === YT.PlayerState.PLAYING) {
                this.$root.$emit('send', {
                  type: 'video--update',
                  state: YT.PlayerState.PLAYING,
                  time: this.getPlayerTime(),
                });

                this.flags &= ~PlayerFlags.Paused;
              }
              // paused - send update and set the paused flag
              else if (state === YT.PlayerState.PAUSED) {
                this.$root.$emit('send', {
                  type: 'video--update',
                  state: YT.PlayerState.PAUSED,
                  time: this.getPlayerTime(),
                });

                this.flags |= PlayerFlags.Paused;
              }
              // ended - send update and set the paused flag
              else if (state === YT.PlayerState.ENDED) {
                this.$root.$emit('send', {
                  type: 'video--update',
                  state: YT.PlayerState.ENDED,
                });

                console.warn('video ended.');

                this.flags |= PlayerFlags.Paused;
                this.ignorePlayerState = true;
              }

              console.log('PlayerStateChange - sent updated state');
            },

            /**
             * Player playback rate changed
             */
            onPlaybackRateChange: (event) => {
              this.$root.$emit('send', {
                type: 'video--playbackrate',
                rate: event.data,
              });
            },
          },
        });
      },

      /**
       * Update the player state
       */
      updateState({ state, time = 0 }) {
        if (!(this.flags & PlayerFlags.Ready)) {
          console.error('updateState - YouTube player isn\'t ready yet!');
        }

        if (this.currentVideo) {
          this.currentVideo.state = state;
        }

        console.log('updateState', state, time);

        if (state === YT.PlayerState.PLAYING) {
          this.player.playVideo();
          this.flags &= ~PlayerFlags.Paused;
        } else if (state === YT.PlayerState.PAUSED) {
          this.player.seekTo(time, true);
          this.player.pauseVideo();
          this.flags |= PlayerFlags.Paused;
        } else if (state === YT.PlayerState.ENDED) {
          this.player.stopVideo();
          this.flags |= PlayerFlags.Paused;
        }
      },

      /**
       * Set the player playback rate
       */
      setPlaybackRate(rate) {
        if (!(this.flags & PlayerFlags.Ready)) {
          // TODO: we should store the playback rate, then set it once the player is ready!
        }

        this.player.setPlaybackRate(rate);
      },

      /**
       * Get the current player time with ping corrections
       */
      getPlayerTime() {
        if (!(this.flags & PlayerFlags.Ready)) {
          return 0;
        }

        return (this.player.getCurrentTime() + (this.ping / 1000));
      },

      /**
       * Calculate the real player time with ping corrections
       */
      calcNetworkPlayerTime(time, ignore_delta = false) {
        console.log(`calcNetworkPlayerTime(${time})`);

        time = (time + (this.ping / 1000));
        const delta = Math.abs(time - this.player.getCurrentTime());
        console.log(` delta: ${delta}`);

        this.$root.$emit('debugPlayerDelta', delta);

        if (!ignore_delta && delta < 0.6) {
          return false;
        }

        return time;
      },

      /**
       * Send video clock data to the server
       */
      sendVideoClockData() {
        this.$root.$emit('send', {
          type: 'video--clock',
          id: this.currentVideo.id,
          time: this.getPlayerTime(),
        });
      },
    },
    computed: {
      isOnline: () => store.state.online,
      isHost: () => store.state.host,
      ping: () => store.state.ping,
    },
    watch: {
      isOnline(state) {
        if (state === false) {
          const prevflags = this.flags;

          // reset
          this.videoToQueue = '';
          this.flags = 0;
          this.currentVideo = null;
          this.videoToPlayWhenReady = null;
          this.resyncClock = false;
          this.ignorePlayerState = true;

          // destroy the player
          if (prevflags & PlayerFlags.Ready) {
            this.player.destroy();
            this.createPlayer();
          }
        }
      },
    },
  });
</script>

<style lang="scss">
  @import '../mixins.scss';

  .player {
    grid-column: 1 / 3;

    // 16:9 player aspect ratio
    .player__iframe-container {
      position: relative;
      padding-bottom: 56.25%;
      height: 0;
      overflow: hidden;
      margin-bottom: 20px;
      border-radius: 2px;

      iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    }
  }
</style>
