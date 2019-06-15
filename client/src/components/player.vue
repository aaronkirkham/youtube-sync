<template>
  <main class="player" id="player">
    <div class="player__iframe-container">
      <div id="player__iframe"></div>
      <div id="player__debug" v-if="showDebugView">
        <table class="debug-info">
          <tr>
            <td>State:</td>
            <td :style="{ color: isOnline ? 'inherit' : 'red'}">{{ isOnline ? 'Online' : 'Offline' }}</td>
          </tr>
          <tr>
            <td>Ping:</td>
            <td>{{ ping }}</td>
          </tr>
          <tr>
            <td>Is Host:</td>
            <td>{{ isHost ? 'Yes' : 'No' }}</td>
          </tr>
          <tr>
            <td>Delta:</td>
            <td :style="{ color: debugDeltaColour() }">{{ delta.toFixed(4) }}</td>
          </tr>
          <tr>
            <td>Flags:</td>
            <td>{{ flags.toString(2).padStart(8, '0') }}</td>
          </tr>
        </table>
      </div>
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
    Ready:                (1 << 0), // player is ready to rock
    Paused:               (1 << 1), // current video is paused
    WaitForTargetState:   (1 << 2), // waiting for player to reach the target state
    ForceUpdateStates:    (1 << 3), // states should be updated instantly
  };

  export default Vue.component('youtube-player', {
    data() {
      return {
        player: null,
        flags: 0,
        videoToQueue: 'https://www.youtube.com/watch?v=hAxSVf7zoD8',
        currentVideo: null,
        currentState: -1, // YT.PlayerState.UNSTARTED
        videoToPlayWhenReady: null,
        delta: 0,
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
      this.$root.$on('server__video--state', this.updateState);
      this.$root.$on('server__video--playbackrate', ({ rate }) => this.setPlaybackRate(rate));
      this.$root.$on('server__room--update', ({ current }) => this.play(current));

      this.$root.$on('server__video--clock', (data) => {
        if (this.currentState === YT.PlayerState.UNSTARTED) return;
        else if (this.flags & PlayerFlags.WaitForTargetState) return;
        else if (this.currentVideo.id !== data.id) return;

        const time = this.calcNetworkPlayerTime(data.time);
        if (time === false) return;

        this.player.seekTo(time, true);
      });

      this.$root.$on('server__pong', (data) => {
        if (!this.isHost) return;
        else if (!this.currentVideo) return;
        else if (!(this.flags & PlayerFlags.Ready)) return;
        else if (this.flags & PlayerFlags.Paused) return;

        this.sendVideoClockData();
        this.delta = 0;
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
        if (!video) return;

        // player isn't ready yet
        if (!(this.flags & PlayerFlags.Ready)) {
          console.warn('Play - player isn\'t ready yet. video will start when playing is loaded.');
          this.videoToPlayWhenReady = video;
          this.flags |= PlayerFlags.ForceUpdateStates;
          return;
        }

        let time = video.time ? video.time : 0;

        // if the video is playing, calculate the network player time
        if (video.state === 1) {
          time = this.calcNetworkPlayerTime(video.time, true);
        }

        if (typeof video.state === 'undefined') {
          video.state = YT.PlayerState.UNSTARTED;
        }

        console.log(`Play - Loading video... Time: ${time}, TargetState: ${this.stateToString(video.state)}`);

        this.currentVideo = video;
        this.currentState = YT.PlayerState.UNSTARTED;
        this.player.loadVideoById(video.videoId, time, 'default');
        document.title = `${video.title} - YouTube Sync`;

        // set the playback rate if we need to
        if (typeof video.rate !== 'undefined') {
          console.log(`Play - setting video playback rate to '${video.rate}'...`);
          this.player.setPlaybackRate(video.rate);
        }
      },

      /**
       * Initialise YouTube player iframe
       */
      createPlayer() {
        this.player = new YT.Player('player__iframe', {
          width: 1280,
          height: 720,
          playerVars: {
            modestbranding: 1,  // hide youtube logo in the control bar
          },
          events: {
            onReady: this.onPlayerReady,
            onStateChange: this.onPlayerStateChange,
            onPlaybackRateChange: this.onPlayerPlaybackRateChange,
          },
        });
      },

      /**
       * YouTube Player is ready
       */
      onPlayerReady() {
        this.flags |= PlayerFlags.Ready;

        // do we have a video waiting to play?
        if (this.videoToPlayWhenReady) {
          this.play(this.videoToPlayWhenReady);
          this.videoToPlayWhenReady = null;
        }
      },

      stateToString(state = this.currentState) {
        switch (state) {
          case YT.PlayerState.UNSTARTED:  return 'UNSTARTED';
          case YT.PlayerState.ENDED:      return 'ENDED';
          case YT.PlayerState.PLAYING:    return 'PLAYING';
          case YT.PlayerState.PAUSED:     return 'PAUSED';
          case YT.PlayerState.BUFFERING:  return 'BUFFERING';
          case YT.PlayerState.CUED:       return 'VIDEO CUED';
          default:                        return 'UNKNOWN';
        }
      },

      /**
       * YouTube Player state changed
       */
      onPlayerStateChange(event) {
        const state = event.data;
        let sendStateData = true;

        // ignore unstarted and buffering states
        if (state === YT.PlayerState.UNSTARTED) return;
        else if (state === YT.PlayerState.BUFFERING) return;
        else if (state === YT.PlayerState.ENDED && !this.isHost) return;

        console.log(`PlayerStateChange - PlayerState: ${this.stateToString(state)}, CurrentState: ${this.stateToString()}`);

        // video started playing and current state was unstarted
        if (state === YT.PlayerState.PLAYING && this.currentState === YT.PlayerState.UNSTARTED) {
          console.warn('VIDEO STARTED PLAYING');

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

        if (state === YT.PlayerState.PLAYING) {
          this.flags &= ~PlayerFlags.Paused;
        } else if (state === YT.PlayerState.PAUSED) {
          this.flags |= PlayerFlags.Paused;
        }

        // send state info to the server
        if (sendStateData) {
          console.log('sending state data..');
          this.sendVideoStateData(state);
        }
      },

      /**
       * YouTube Player playback rate changed
       */
      onPlayerPlaybackRateChange(event) {
        this.$root.$emit('send', {
          type: 'video--playbackrate',
          rate: event.data,
        });
      },

      /**
       * Update the player state
       */
      updateState({ state, time = 0 }) {
        if (!(this.flags & PlayerFlags.Ready)) {
          console.error('UpdateState - player isn\'t ready yet!');
        }

        if (this.currentVideo) {
          this.currentVideo.state = state;
        }

        // set the set by server flag, so we ignore the state change events later
        this.flags |= PlayerFlags.WaitForTargetState;

        console.log(`UpdateState - TargetState: ${this.stateToString(state)}, Time: ${time}`);

        if (state === YT.PlayerState.PLAYING) {
          this.player.playVideo();
          this.flags &= ~PlayerFlags.Paused;
        } else if (state === YT.PlayerState.PAUSED) {
          this.player.seekTo(time, true);
          this.player.pauseVideo();
          this.flags |= PlayerFlags.Paused;
        } else if (state === YT.PlayerState.ENDED) {
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
      calcNetworkPlayerTime(time, ignore_delta = false) {
        time = (time + (this.ping / 1000));
        const delta = Math.abs(time - this.player.getCurrentTime());

        // @Debugging
        this.delta = delta;

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
        if (this.delta > 0.4) return 'red'
        else if (this.delta > 0.25) return 'orange';
        return 'inherit';
      },
    },
    computed: {
      isOnline: () => store.state.online,
      isHost: () => store.state.host,
      ping: () => store.state.ping,
      showDebugView: () => process.env.mode === 'development',
    },
    watch: {
      isOnline(state) {
        if (state === false) {
          const prevflags = this.flags;

          // reset
          this.videoToQueue = '';
          this.flags = 0;
          this.currentVideo = null;
          this.currentState = YT.PlayerState.UNSTARTED;
          this.videoToPlayWhenReady = null;

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

  #player__debug {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 9999;
    user-select: none;
    pointer-events: none;
    background-color: #000000;
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
