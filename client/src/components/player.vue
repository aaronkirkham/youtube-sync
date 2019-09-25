<template>
  <main id="player" class="player">
    <div class="player__iframe-container">
      <div id="player__iframe" />
      <div v-if="error" class="player__error">
        <span>{{ error }}</span>
        <span v-if="showNextVideoStr">The next video will begin shortly...</span>
      </div>
      <div v-if="showDebugView" id="player__debug">
        <table class="debug-info">
          <tr>
            <td>State:</td>
            <td :style="{ color: isOnline ? 'inherit' : 'red'}">
              {{ isOnline ? 'Online' : 'Offline' }}
            </td>
          </tr>
          <tr>
            <td>Flags:</td>
            <td>{{ flags.toString(2).padStart(8, '0') }}</td>
          </tr>
          <tr>
            <td>Ping:</td>
            <td>{{ ping }} ms</td>
          </tr>
          <tr>
            <td>Is Host:</td>
            <td>{{ isHost ? 'Yes' : 'No' }}</td>
          </tr>
          <tr>
            <td>Delta:</td>
            <td :style="{ color: debugDeltaColour() }">{{ delta.toFixed(4) }}</td>
          </tr>
        </table>
      </div>
    </div>
    <div v-if="showAutoplayNotices && autoplayCaps === 2" class="player__autoplay-caps">Your browser has strict autoplay settings. The audio has been muted.</div>
    <div v-else-if="showAutoplayNotices && autoplayCaps === 0" class="player__autoplay-caps player__autoplay-caps--forbidden">Your browser has strict autoplay settings. The video has been paused.</div>
  </main>
</template>

<script>
  import { mapState } from 'vuex';
  import { AutoplayCapabilities, getAutoplayCapabilities } from '../autoplay';

  /* eslint-disable no-bitwise */
  const PlayerFlags = {
    Ready: (1 << 0), // player is ready to rock
    Paused: (1 << 1), // current video is paused
    WaitForTargetState: (1 << 2), // waiting for player to reach the target state
    ForceUpdateStates: (1 << 3), // states should be updated instantly
  };

  // Clone of YT.PlayerState object.
  // NOTE: because we load the youtube player API async it's not guaranteed
  //       that object will be available.
  const PlayerState = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
  };

  export default {
    name: 'YoutubePlayer',
    data() {
      return {
        player: null,
        flags: 0,
        currentVideo: null,
        currentState: PlayerState.UNSTARTED,
        videoToPlayWhenReady: null,
        stateToSetWhenReady: null,
        delta: 0,
        autoplayCaps: AutoplayCapabilities.Forbidden,
        showAutoplayNotices: false,
        error: null,
        showNextVideoStr: false,
      };
    },
    computed: {
      ...mapState({
        isOnline: state => state.online,
        isHost: state => state.host,
        ping: state => state.ping,
      }),
      showDebugView: () => process.env.MODE === 'development',
    },
    watch: {
      isOnline(state) {
        // reset everything if we go offline
        if (state === false) {
          this.reset();
        }
      },
    },
    metaInfo() {
      return {
        title: this.currentVideo ? this.currentVideo.title : undefined,
        titleTemplate: this.currentVideo ? '%s - TubeSync' : 'TubeSync',
      };
    },
    created() {
      // prefetch autoplay capabilities, so we know how to deal with the player when it loads
      getAutoplayCapabilities((caps) => { this.autoplayCaps = caps; });

      const script = document.createElement('script');
      script.setAttribute('async', true);
      script.setAttribute('src', 'https://youtube.com/iframe_api');
      document.head.appendChild(script);
    },
    mounted() {
      this.$root.$on('server__video--play', this.play);
      this.$root.$on('server__video--state', this.updateState);
      this.$root.$on('server__video--playbackrate', ({ rate }) => this.setPlaybackRate(rate));
      this.$root.$on('server__video--ended', this.reset);
      this.$root.$on('server__room--update', ({ current }) => this.play(current));

      this.$root.$on('server__video--clock', (data) => {
        if (this.currentState === PlayerState.UNSTARTED) return;
        if (this.flags & PlayerFlags.WaitForTargetState) return;
        if (this.currentVideo.id !== data.id) return;

        const time = this.calcNetworkPlayerTime(data.time);
        if (time === false) return;

        this.player.seekTo(time, true);
      });

      this.$root.$on('server__pong', () => {
        if (!this.isHost) return;
        if (!this.currentVideo) return;
        if (!(this.flags & PlayerFlags.Ready)) return;
        if (this.flags & PlayerFlags.Paused) return;

        this.sendVideoClockData();
        this.delta = 0;
      });

      // youtube iframe ready
      window.onYouTubeIframeAPIReady = this.createPlayer;
    },
    methods: {
      /**
       * Start playing a video
       */
      play(video) {
        if (!video) return;

        // player isn't ready yet
        if (!(this.flags & PlayerFlags.Ready)) {
          console.warn('Play - player isn\'t ready yet. video will start when player is loaded.');
          this.videoToPlayWhenReady = video;
          this.flags |= PlayerFlags.ForceUpdateStates;
          return;
        }

        // try again with the autoplay capabilities, the user may have
        // interacted with the page or changed settings
        if (this.autoplayCaps !== AutoplayCapabilities.Allowed) {
          getAutoplayCapabilities((caps) => {
            this.autoplayCaps = caps;
            this.showAutoplayNotices = (caps !== AutoplayCapabilities.Allowed);

            if (this.showAutoplayNotices) {
              setTimeout(() => { this.showAutoplayNotices = false; }, 3500);
            }
          });
        }

        // if there is already a video playing, wait for the target from the host
        if (!this.isHost && this.currentState === PlayerState.PLAYING) {
          this.flags |= PlayerFlags.WaitForTargetState;
        }

        let time = video.time ? video.time : 0;

        // if the video is playing, calculate the network player time
        if (video.state === 1) {
          time = this.calcNetworkPlayerTime(video.time, true);
        }

        this.error = null;
        this.currentVideo = video;
        this.currentState = PlayerState.UNSTARTED;

        if (typeof video.state === 'undefined') {
          this.currentVideo.state = PlayerState.UNSTARTED;
        }

        this.player.loadVideoById(video.videoId, time, 'default');

        console.log(`Play - Loading video... Time: ${time}, TargetState: ${this.stateToString(this.currentVideo.state)}`);

        // set the playback rate if we need to
        if (typeof video.rate !== 'undefined') {
          console.log(`Play - setting video playback rate to '${video.rate}'...`);
          this.player.setPlaybackRate(video.rate);
        }
      },

      /**
       * Reset all data and recreate the player
       */
      reset() {
        const recreatePlayer = (this.flags & PlayerFlags.Ready);

        // reset
        this.error = null;
        this.flags = 0;
        this.currentVideo = null;
        this.currentState = PlayerState.UNSTARTED;
        this.videoToPlayWhenReady = null;
        this.delta = 0;

        // destroy the player
        if (recreatePlayer) {
          this.player.destroy();
          this.createPlayer();
        }
      },

      /**
       * Initialise YouTube player iframe
       */
      createPlayer() {
        /* eslint-disable no-undef */
        this.player = new YT.Player('player__iframe', {
          width: 1280,
          height: 720,
          playerVars: {
            autoplay: 1, // always autoplay
            modestbranding: 1, // hide youtube logo in the control bar
            playsinline: 1, // play inline videos on iOS
          },
          events: {
            onReady: this.onPlayerReady,
            onStateChange: this.onPlayerStateChange,
            onPlaybackRateChange: this.onPlayerPlaybackRateChange,
            onError: this.onPlayerError,
          },
        });
      },

      /**
       * YouTube Player is ready
       */
      onPlayerReady() {
        this.flags |= PlayerFlags.Ready;

        console.log('Player is ready! AutoplayCapabilities:', this.autoplayCaps);
        if (this.autoplayCaps === AutoplayCapabilities.OnlyWhenMuted) {
          this.player.mute();
        }

        // do we have a video waiting to play?
        if (this.videoToPlayWhenReady) {
          this.play(this.videoToPlayWhenReady);
          this.videoToPlayWhenReady = null;
        }

        // update state if we need to
        if (this.stateToSetWhenReady) {
          this.updateState(this.stateToSetWhenReady);
          this.stateToSetWhenReady = null;
        }
      },

      /**
       * YouTube Player state changed
       */
      // @BUG: Safari will always seem to emit PAUSED when we initially load the page
      // this causes everyones video to pause.
      onPlayerStateChange(event) {
        const state = event.data;
        let sendStateData = true;

        // ignore unstarted and buffering states
        if (state === PlayerState.UNSTARTED) return;
        if (state === PlayerState.BUFFERING) return;
        if (state === PlayerState.ENDED && !this.isHost) return;

        console.log(`PlayerStateChange - PlayerState: ${this.stateToString(state)}, CurrentState: ${this.stateToString()}`);

        // special case for iphone/ipod users who are not the host
        // NOTE: enter/exiting fullscreen is weird, because the native iOS player will be running.
        //       When we exit fullscreen, we get the PAUSED event, when we enter fullscreen we get
        //       the PLAYING event.
        if ((navigator.platform === 'iPhone' || navigator.platform === 'iPod') && !this.isHost) {
          // keep the video paused
          if (state === PlayerState.PLAYING && this.currentVideo.state !== PlayerState.PLAYING) {
            this.player.pauseVideo();
            return;
          }

          // keep the video playing
          if (state === PlayerState.PAUSED && this.currentVideo.state !== PlayerState.PAUSED) {
            this.player.playVideo();
            return;
          }
        }

        // video started playing and current state was unstarted
        if (state === PlayerState.PLAYING && this.currentState === PlayerState.UNSTARTED) {
          // update player states if needed
          if (this.flags & PlayerFlags.ForceUpdateStates) {
            this.updateState(this.currentVideo);
            this.flags &= ~PlayerFlags.ForceUpdateStates;
          }

          // only send the state data if we are the room host
          sendStateData = this.isHost;
        }

        // ignore the current state if we are trying to reach the server state
        // this is so we don't send state data when someone else plays/pauses the video
        if (this.flags & PlayerFlags.WaitForTargetState) {
          sendStateData = false;

          if (state === this.currentVideo.state) {
            this.flags &= ~PlayerFlags.WaitForTargetState;
          }
        }

        // dont send state data if the current player state is where we were expecting
        if (state === this.currentState) {
          sendStateData = false;
        }

        // update the current video state
        this.currentState = state;

        if (state === PlayerState.PLAYING) {
          this.flags &= ~PlayerFlags.Paused;
        } else if (state === PlayerState.PAUSED) {
          this.flags |= PlayerFlags.Paused;
        }

        // send state info to the server
        if (sendStateData) {
          this.sendVideoStateData(state);
        }
      },

      /**
       * YouTube Player playback rate changed
       */
      onPlayerPlaybackRateChange({ data }) {
        this.$root.$emit('send', {
          type: 'video--playbackrate',
          rate: data,
        });
      },

      /**
       * YouTube Player error
       */
      onPlayerError({ data }) {
        if (data === 100) {
          this.error = 'The current video was not found. It has either been removed or is private.';
        } else if (data === 101 || data === 150) {
          this.error = 'The owner of the current video does not allow it to be played in embedded players.';
        } else {
          this.error = `The current video can not be played. (Error: ${data})`;
        }

        // if we have more items in the queue, show the next video label
        const { queue } = this.$parent.$refs;
        this.showNextVideoStr = (queue.items.length !== 0);

        // tell the server the video has an error
        if (this.isHost) {
          this.$root.$emit('send', { type: 'video--error' });
        }
      },

      /**
       * Update the player state
       */
      updateState({ state, time = 0 }) {
        if (!(this.flags & PlayerFlags.Ready)) {
          console.warn('UpdateState - Player isn\'t ready yet!');
          this.stateToSetWhenReady = { state, time };
          return;
        }

        if (this.currentVideo) {
          this.currentVideo.state = state;
        }

        // set the set by server flag, so we ignore the state change events later
        if (this.currentState !== state) {
          this.flags |= PlayerFlags.WaitForTargetState;
        } else if (this.flags & PlayerFlags.WaitForTargetState) {
          this.flags &= ~PlayerFlags.WaitForTargetState;
        }

        console.log(`UpdateState - TargetState: ${this.stateToString(state)}, Time: ${time}`);

        if (state === PlayerState.PLAYING) {
          this.player.playVideo();
          this.flags &= ~PlayerFlags.Paused;
        } else if (state === PlayerState.PAUSED) {
          this.player.seekTo(time, true);
          this.player.pauseVideo();
          this.flags |= PlayerFlags.Paused;
        } else if (state === PlayerState.ENDED) {
          this.player.stopVideo();
        }
      },

      /**
       * Set the player playback rate
       */
      setPlaybackRate(rate) {
        if (!(this.flags & PlayerFlags.Ready)) {
          return;
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
      calcNetworkPlayerTime(time, ignoreDelta = false) {
        const t = (time + (this.ping / 1000));
        const delta = Math.abs(t - this.player.getCurrentTime());

        // @Debugging
        this.delta = delta;

        if (!ignoreDelta && delta < 0.6) {
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

      /**
       * Send video state data to the server
       */
      sendVideoStateData(state) {
        this.$root.$emit('send', {
          type: 'video--update',
          time: this.getPlayerTime(),
          state,
        });
      },

      debugDeltaColour() {
        if (this.delta > 0.4) return 'red';
        if (this.delta > 0.25) return 'orange';
        return 'inherit';
      },

      stateToString(state = this.currentState) {
        switch (state) {
        case PlayerState.UNSTARTED: return 'UNSTARTED';
        case PlayerState.ENDED: return 'ENDED';
        case PlayerState.PLAYING: return 'PLAYING';
        case PlayerState.PAUSED: return 'PAUSED';
        case PlayerState.BUFFERING: return 'BUFFERING';
        case PlayerState.CUED: return 'VIDEO CUED';
        default: return 'UNKNOWN';
        }
      },
    },
  };
</script>

<style lang="scss">
  .player {
    position: relative;

    @media (max-width: 1220px) {
      grid-column: 1 / 3;
    }

    // 16:9 player aspect ratio
    .player__iframe-container {
      position: relative;
      padding-bottom: 56.25%;
      height: 0;
      overflow: hidden;
      border-radius: 2px;

      iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    }

    .player__autoplay-caps {
      position: absolute;
      bottom: 61px;
      left: -5px;
      font-size: 14px;
      font-weight: 400;
      color: #282828;
      padding: 10px 15px 9px;
      background-color: #eca832;
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);
      border-radius: 2px;
      user-select: none;
      pointer-events: none;

      &::before {
        content: "";
        position: absolute;
        top: 100%;
        left: 72px;
        width: 0;
        height: 0;
        border: solid transparent;
        border-color: rgba(136, 183, 213, 0);
        border-top-color: #eca832;
        border-width: 7px;
        pointer-events: none;
      }

      &--forbidden {
        background-color: #d25a3c;

        &::before {
          left: 34px;
          border-top-color: #d25a3c;
        }
      }
    }
  }

  .player__error {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    padding: 10px;
    align-items: center;
    justify-content: center;
    user-select: none;

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.75);
    }

    span {
      position: relative;
      padding: 10px 15px;
      background-color: rgba(255, 0, 0, 0.75);
      z-index: 1;
    }
  }

  #player__debug {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 99;
    user-select: none;
    pointer-events: none;
    background-color: #282828;
    padding: 5px;
    opacity: 0.75;

    .debug-info {
      width: 100%;

      tr {
        td:first-child {
          padding-right: 25px;
        }

        td:last-child {
          text-align: right;
        }
      }
    }
  }
</style>
