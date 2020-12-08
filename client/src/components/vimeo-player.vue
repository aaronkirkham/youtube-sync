<template>
  <iframe id="player__iframe" ref="player" src="https://player.vimeo.com/video/259411563?autoplay=1&amp;muted=1" width="1280" height="720" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen allow="autoplay"></iframe>
</template>

<script>
import { mapState } from 'vuex';
import { AutoplayCapabilities } from '../autoplay';

/* eslint-disable no-bitwise */
const PlayerFlags = {
  Ready: (1 << 0), // player is ready to rock
  Paused: (1 << 1), // current video is paused
  // WaitForTargetState: (1 << 2), // waiting for player to reach the target state
  // ForceUpdateStates: (1 << 3), // states should be updated instantly
};

const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
};

export default {
  name: 'VimeoPlayer',
  data() {
    return {
      player: null,
      flags: 0,
      currentVideo: null,
      currentState: PlayerState.UNSTARTED,
      videoToPlayWhenReady: null,
    };
  },
  computed: {
    ...mapState({
      isHost: state => state.host,
      ping: state => state.ping,
    }),
  },
  created() {
    // inject vimeo api scripts
    if (typeof Vimeo === 'undefined') {
      const script = document.createElement('script');
      script.setAttribute('async', true);
      script.setAttribute('src', 'https://player.vimeo.com/api/player.js');
      script.onload = this.createPlayer;
      document.head.appendChild(script);
    }
  },
  mounted() {
    if (typeof Vimeo !== 'undefined') {
      this.createPlayer();
    }
  },
  beforeDestroy() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  },
  methods: {
    /**
     * Initialise Vimeo player iframe
     */
    createPlayer() {
      console.log('Vimeo createPlayer');
      this.player = new Vimeo.Player(this.$refs.player);

      this.player.ready().then(this.onPlayerReady);

      // bind events
      this.player.on('ended', () => this.onPlayerStateChange(PlayerState.ENDED));
      this.player.on('play', () => this.onPlayerStateChange(PlayerState.PLAYING));
      this.player.on('pause', () => this.onPlayerStateChange(PlayerState.PAUSED));

      /*
        bufferend
        bufferstart
        ended
        error
        loaded
        pause
        play
        playbackratechange
        progress
        seeked
        timeupdate
        volumechange
      */

      // this.player.loadVideo(210599507)
      //   .then(() => console.log('video is loaded!'))
      //   .catch((err) => console.error('something went wrong!', err));
    },

    /**
     * Vimeo player is ready
     */
    onPlayerReady() {
      this.flags |= PlayerFlags.Ready;

      const caps = this.$parent.getAutoplayCapabilities();
      console.log('Player is ready! Autoplay Capabilities:', caps);

      if (caps === AutoplayCapabilities.OnlyWhenMuted) {
        console.warn('need to mute player!');
      }

      // do we have a video waiting to play?
      if (this.videoToPlayWhenReady) {
        this.play(this.videoToPlayWhenReady);
        this.videoToPlayWhenReady = null;
      }
    },

    /**
     * YouTube Player state changed
     */
    onPlayerStateChange(state) {
      let sendStateData = true;

      // ignore unstarted and buffering states
      if (state === PlayerState.UNSTARTED) return;
      if (state === PlayerState.ENDED && !this.isHost) return;

      console.log(`PlayerStateChange - PlayerState: ${this.stateToString(state)}, CurrentState: ${this.stateToString()}`);

      // video started playing and the current state was unstarted
      if (state === PlayerState.PLAYING && this.currentState === PlayerState.UNSTARTED) {
        // update player states if needed
        // TODO

        // only send the state data if we are the room host
        sendStateData = this.isHost;
      }

      // don't send state data if the current player state is where we were expecting
      if (state === this.currentState) {
        sendStateData = false;
      }

      // update the current video state
      this.currentState = state;

      // send state info to the server
      if (sendStateData) {
        this.sendVideoStateData(state);
      }
    },

    /**
     * Start playing a video
     */
    play(video) {
      console.log('VIMEO play', video);

      // player is not ready yet
      if (!(this.flags & PlayerFlags.Ready)) {
        console.warn(`Play - Vimeo player is not ready yet. Video will start when player is loaded.`);
        this.videoToPlayWhenReady = video;
        this.flags |= PlayerFlags.ForceUpdateStates;
        return;
      }

      // if there is already a video playing, wait for the target from the host
      if (!this.isHost && this.currentState === PlayerState.PLAYING) {
        // this.flags |= PlayerFlags.WaitForTargetState;
      }

      let time = video.time ? video.time : 0;

      // if the video is playing, calculate the network player time
      if (video.state === PlayerState.PLAYING) {
        time = this.$parent.calculateNetworkTime(video.time, true);
      }

      this.currentVideo = video;
      this.currentState = PlayerState.UNSTARTED;

      if (typeof video.state === 'undefined') {
        this.currentVideo.state = PlayerState.UNSTARTED;
      }

      // load and play video
      this.player.loadVideo(video.videoId)
        .then(() => this.player.play());

      console.log(`Play - Loading video... Time: ${time}, TargetState: ${this.stateToString(this.currentVideo.state)}`);

      // set the playback rate if we need to
      if (typeof video.rate !== 'undefined') {
        console.log(`Play - setting video playback rate to '${video.rate}'...`);
        // this.player.setPlaybackRate(video.rate);
      }
    },

    /**
     * Clock update from room host
     */
    clockUpdate({ id, time }) {
      if (this.currentState === PlayerState.UNSTARTED) return console.warn('UNSTARTED');
      // if (this.flags & PlayerFlags.WaitForTargetState) return;
      if (this.currentVideo.id !== id) return console.warn(`${this.currentVideo.id} !== ${id}`);

      this.player.getCurrentTime()
        .then((seconds) => {
          const realTime = this.$parent.calculateNetworkTime(time, seconds);
          console.log('clockUpdate:', realTime);
          if (realTime !== false) {
            this.player.setCurrentTime(realTime);
          }
        });
    },

    /**
     * Are we ready for clock updates?
     */
    isReadyForClockUpdate() {
      if (!this.currentVideo) return false;
      if (!(this.flags & PlayerFlags.Ready)) return false;
      if (this.flags & PlayerFlags.Paused) return false;

      return true;
    },

    /**
     * Get the current player time with ping corrections
     */
    getPlayerTime() {
      return new Promise((resolve, reject) => {
        if (!(this.flags & PlayerFlags.Ready)) {
          return resolve(0);
        }

        this.player.getCurrentTime()
          .then(seconds => resolve(seconds + (this.ping / 1000)))
          .catch(err => reject(err));
      });
    },

    /**
     * Send video clock data to the server
     */
    sendVideoClockData() {
      this.getPlayerTime()
        .then((time) => {
          this.$root.$emit('send', {
            type: 'video--clock',
            id: this.currentVideo.id,
            time,
          });
        });
    },

    /**
     * Send video state data to the server
     */
    sendVideoStateData(state) {
      this.getPlayerTime()
        .then((time) => {
          this.$root.$emit('send', {
            type: 'video--update',
            time,
            state,
          });
        });
    },

    /**
     * Get player bitflags
     */
    getFlags() {
      return this.flags;
    },


    stateToString(state = this.currentState) {
      switch (state) {
      case PlayerState.UNSTARTED: return 'UNSTARTED';
      case PlayerState.ENDED: return 'ENDED';
      case PlayerState.PLAYING: return 'PLAYING';
      case PlayerState.PAUSED: return 'PAUSED';
      // case PlayerState.BUFFERING: return 'BUFFERING';
      // case PlayerState.CUED: return 'VIDEO CUED';
      default: return 'UNKNOWN';
      }
    },
  },
};
</script>