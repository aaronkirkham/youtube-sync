<template>
  <main id="player" class="player">
    <!-- player -->
    <div class="player__iframe-container">
      <component ref="component" :is="playerComponent"/>
    </div>
    <!-- error messages -->
    <div v-if="error" class="player__error">
      <span>{{ error }}</span>
      <span v-if="showNextVideoStr">The next video will begin shortly...</span>
    </div>
    <!-- autoplay capabilities notices -->
    <div v-if="showAutoplayNotices && autoplayCaps === 2" class="player__autoplay-caps">
      Your browser has strict autoplay settings. The audio has been muted.
    </div>
    <div v-else-if="showAutoplayNotices && autoplayCaps === 0" class="player__autoplay-caps player__autoplay-caps--forbidden">
      Your browser has strict autoplay settings. The video has been paused.
    </div>
    <!-- debug info -->
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
          <td v-if="$refs.component">{{ $refs.component.getFlags().toString(2).padStart(8, '0') }}</td>
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
          <td>Delta Time:</td>
          <td :style="{ color: DEBUG_deltaColour() }">{{ delta.toFixed(4) }}</td>
        </tr>
      </table>
    </div>
  </main>
</template>

<script>
import { mapState } from 'vuex';
import YouTubePlayer from './youtube-player.vue';
import VimeoPlayer from './vimeo-player.vue';
import { AutoplayCapabilities, getAutoplayCapabilities } from '../autoplay';

export default {
  components: {
    YouTubePlayer,
    VimeoPlayer,
  },
  data() {
    return {
      playerComponent: null,
      autoplayCaps: AutoplayCapabilities.Forbidden,
      showAutoplayNotices: false,
      error: null,
      showNextVideoStr: false,
      delta: 0,
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
  created() {
    // prefetch autoplay capabilities, so we know how to deal with the player when it loads
    getAutoplayCapabilities(caps => this.autoplayCaps = caps);

    // bind event listeners
    this.$root.$on('server__video--play', this.play);
    this.$root.$on('server__video--state', this.updateState);
    // server__video--playbackrate
    // server__video--ended
    this.$root.$on('server__room--update', ({ current }) => this.play(current));
    this.$root.$on('server__video--clock', this.clockUpdate);
    this.$root.$on('server__pong', this.updateVideoClocks);

    // TEMP
    this.playerComponent = VimeoPlayer;

    // setInterval(() => {
    //   if (this.playerComponent !== VimeoPlayer) {
    //     this.playerComponent = VimeoPlayer;
    //   } else {
    //     this.playerComponent = YouTubePlayer;
    //   }
    // }, 2500);
  },
  methods: {
    /**
     * Start playing a video
     */
    play(video) {
      if (!video) {
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

      //
      this.error = null;

      const { provider } = video;
      switch (provider) {
        case 'YouTube': {
          this.playerComponent = YouTubePlayer;
          break;
        }

        case 'Vimeo': {
          this.playerComponent = VimeoPlayer;
          break;
        }

        default: {
          this.error = `${provider} is not a supported video provider!`;
          // TODO : wait 2-3sec then goto next video in queue :-)
          return;
        }
      }

      // TODO : check video.provier, and set the correct component!
      console.log('play', video);
      this.$refs.component.play(video);
    },

    /**
     * Update the player state
     */
    updateState({ state, time = 0 }) {
      console.log('updateState', state, time);
    },

    clockUpdate(data) {
      this.$refs.component.clockUpdate(data);
    },

    /**
     * Update video clocks
     */
    updateVideoClocks() {
      if (!this.isHost) return;
      if (!this.$refs.component.isReadyForClockUpdate()) return;

      this.$refs.component.sendVideoClockData();
      this.delta = 0;
    },

    /**
     * Calculate the player time with ping corrections
     */
    calculateNetworkTime(time, playerTime, ignoreDelta = false) {
      const t = (time + (this.ping / 1000));
      const delta = Math.abs(t - playerTime);
      this.delta = delta;

      // delta is under .6s, return false will prevent seeking in the player.
      if (!ignoreDelta && delta < 0.6) {
        return false;
      }

      // delta was too high, return a time to seek to in the player
      return time;
    },

    /**
     * Get player autoplay capabilities
     */
    getAutoplayCapabilities() {
      return this.autoplayCaps;
    },

    DEBUG_deltaColour() {
      if (this.delta > 0.4) return 'red';
      if (this.delta > 0.25) return 'orange';
      return 'inherit';
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

  &__iframe-container {
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

  &__autoplay-caps {
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

  &__error {
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