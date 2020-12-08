<template>
  <div id="player__iframe"/>
</template>

<script>
import { mapState } from 'vuex';

export default {
  name: 'YouTubePlayer',
  data() {
    return {
      player: null,
    };
  },
  created() {
    // inject youtube api scripts
    if (typeof YT === 'undefined') {
      const script = document.createElement('script');
      script.setAttribute('async', true);
      script.setAttribute('src', 'https://youtube.com/iframe_api');
      document.head.appendChild(script);

      // youtube iframe ready
      window.onYouTubeIframeAPIReady = this.createPlayer;
    }
  },
  mounted() {
    if (typeof YT !== 'undefined') {
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
    createPlayer() {
      console.log('YT createPlayer');
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
          // onReady: this.onPlayerReady,
          // onStateChange: this.onPlayerStateChange,
          // onPlaybackRateChange: this.onPlayerPlaybackRateChange,
          // onError: this.onPlayerError,
        },
      });
    },
  },
};
</script>