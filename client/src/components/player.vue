<template>
  <main class="player" id="player">
    <div class="player__iframe-container">
      <div id="player__iframe"></div>
    </div>
    <div class="style-input">
      <input type="text" class="input" placeholder="Paste a YouTube URL..." v-model="video_to_queue" @keyup.enter="client_requestVideo()" />
      <button type="submit" class="button" @click="client_requestVideo()">Queue</button>
    </div>
    <button @click="client_debugQueue()" style="position:absolute;bottom:50px;">Queue Debug Videos</button>
  </main>
</template>

<script>
  import Vue from 'vue';
  import store from '../store';

  const PlayerFlags = {
    Ready: 1,
    Paused: 2,
    Waiting: 4,
  };

  export default Vue.component('youtube-player', {
    data() {
      return {
        player: null,
        video_to_queue: '',
        flags: 0,
        current: null,
        when_ready: null,
        resync_clock: false,
        ignore_player_state: true,
      };
    },
    created() {
      const script = document.createElement('script');
      script.setAttribute('async', true);
      script.setAttribute('src', 'https://youtube.com/iframe_api');

      document.head.appendChild(script);
    },
    mounted() {
      this.$root.$on('server__video--play', data => this.server_playVideo(data));
      this.$root.$on('server__video--update', data => {});
      this.$root.$on('server__video--state', data => {
        this.ignore_player_state = true;
        this.server_updatePlayerState(data);
      });
      this.$root.$on('server__video--playback-rate', data => this.server_updatePlaybackRate(data));
      this.$root.$on('server__room--update', data => this.server_playVideo(data.current));

      this.$root.$on('server__video--clock', data => {
        console.log('server__video--clock', data);

        if (this.current.id === data.id) {
          const time = this.calcNetworkPlayerTime(data.time);
          if (time !== false) {
            this.player.seekTo(time, true);
            console.log('FORCED RESYNC', time);
          }
        }
        else {
          console.error('got clock update for a different video!', data.id, this.current.id);
        }
      });

      this.$root.$on('server__pong', ping => {
        // send the clock update
        if (this.isHost && this.current && ((this.flags & PlayerFlags.Ready) && !(this.flags & PlayerFlags.Paused))) {
          this.$root.$emit('send', {
            type: 'video--clock',
            id: this.current.id,
            time: this.client_getNetworkPlayerTime(),
          });
        }
      });

      // youtube iframe ready
      window.onYouTubeIframeAPIReady = this.client_createPlayer;
    },
    methods: {
      // #######################################
      // ## CLIENT RELATED METHODS
      // #######################################
      client_createPlayer() {
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
            'onReady': this.client_playerReady,
            'onStateChange': this.client_playerStateChange,
            'onPlaybackRateChange': this.client_playerPlaybackRateChange,
          },
        });
      },
      client_playerReady() {
        this.flags |= PlayerFlags.Ready;

        // do we have a video ready to play?
        if (this.flags & PlayerFlags.Waiting) {
          if (this.when_ready) {
            this.server_playVideo(this.when_ready);
            this.when_ready = null;
            this.resync_clock = true;
          }

          this.flags &= ~PlayerFlags.Waiting;
        }
      },
      client_playerStateChange(event) {
        const state = event.data;

        // ignore buffering stuff
        if (state === YT.PlayerState.BUFFERING) {
          return false;
        }

        console.log(`YT PlayerStateChange`, state, this.current.state);

        // once the video has started playing, update the player state if we need to
        if (this.ignore_player_state && state === YT.PlayerState.PLAYING && this.current.state !== state) {
          console.log(`client_playerStateChange - video is playing. we need to get to ${this.current.state}, updating now..`);
          this.server_updatePlayerState(this.current);
          return false;
        }

        // is the player state where it needs to be?
        if (state === this.current.state) {
          if (this.ignore_player_state) {
            this.ignore_player_state = false;
            console.log('client_playerStateChange - player is at the target state.', state);
          }

          // TODO: send time-only update?
          // can't skip into the video when the player is paused

          return false;
        }

        // dont send the important stuff if we don't want to
        if (this.ignore_player_state) {
          return false;
        }

        // update the current video state
        this.current.state = state;

        // playing - send update and remove the paused flag
        if (state === YT.PlayerState.PLAYING) {
          this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.PLAYING, time: this.client_getNetworkPlayerTime() });
          this.flags &= ~PlayerFlags.Paused;
        }
        // paused - send update and set the paused flag
        else if (state === YT.PlayerState.PAUSED) {
          this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.PAUSED, time: this.client_getNetworkPlayerTime() });
          this.flags |= PlayerFlags.Paused;
        }
        // ended - send update and set the paused flag
        else if (state === YT.PlayerState.ENDED) {
          this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.ENDED });
          this.flags |= PlayerFlags.Paused;
        }

        console.log(`sent update-state`);
      },
      client_playerPlaybackRateChange(event) {
        console.log('PlayerPlaybackRateChange');

        this.$root.$emit('send', {
          type: 'video--playback-rate',
          rate: event.data
        });
      },
      client_requestVideo() {
        // make sure we have something to queue
        if (!this.video_to_queue) {
          return;
        }

        // make sure the input url is valid
        const url_segments = this.video_to_queue.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        if (url_segments === null) {
          // TODO: error message
          return;
        }

        // make sure we have a valid id in the video url
        if (typeof url_segments[2] !== 'undefined' && url_segments[2].length === 0) {
          // TODO: error message
          return;
        }

        console.log('requesting video', this.video_to_queue);

        // fetch some basic information about the video
        fetch(`https://noembed.com/embed?url=${this.video_to_queue}`, { method: 'get' })
          .then(response => response.json())
          .then(data => {
            console.log(data);

            const video_obj = {
              id: url_segments[2],
              title: data.title,
              url: data.url,
              thumbnail: data.thumbnail_url,
            };

            // send to the server if we are connected
            if (this.isOnline) {
              this.$root.$emit('send', Object.assign({ type: 'queue--add' }, video_obj));
            }
            else {
              this.$root.$emit('server__queue--add', video_obj);
            }

            this.video_to_queue = '';
          })
          .catch(err => console.error(err));
      },
      // client_changeVideo(video) {
      //   console.log(`requesting change to "${video.title}" (${video.id})...`);
      //   this.$root.$emit('send', { type: 'video--change', id: video.id });
      // },
      client_getNetworkPlayerTime() {
        if (!(this.flags & PlayerFlags.Ready)) {
          return 0;
        }

        return (this.player.getCurrentTime() + (this.ping / 1000));
      },
      client_debugQueue() {
        this.$root.$emit('send', {
          type: 'queue--add',
          id: 'oySqE3z99AE',
          title: 'Hybrid Minds - Inside (ft. Emily Jones)',
          url: 'https://www.youtube.com/watch?v=oySqE3z99AE',
          thumbnail: 'https://i.ytimg.com/vi/oySqE3z99AE/hqdefault.jpg',
        });

        this.$root.$emit('send', {
          type: 'queue--add',
          id: 'JSxCc2e3BEE',
          title: 'Hybrid Minds - Liquicity Winterfestival 2017',
          url: 'https://www.youtube.com/watch?v=JSxCc2e3BEE',
          thumbnail: 'https://i.ytimg.com/vi/JSxCc2e3BEE/hqdefault.jpg',
        });

        this.$root.$emit('send', {
          type: 'queue--add',
          id: '-fCtvurGDD8',
          title: 'Birdy - Wings (Nu:Logic Remix)',
          url: 'https://www.youtube.com/watch?v=-fCtvurGDD8',
          thumbnail: 'https://i.ytimg.com/vi/-fCtvurGDD8/hqdefault.jpg',
        });
      },
      // #######################################
      // ## SERVER RELATED METHODS
      // #######################################
      server_playVideo(video) {
        console.log('server_playVideo');
        if (video && (this.flags & PlayerFlags.Ready)) {
          let time = video.time ? video.time : 0;

          // if the video is playing, calculate the network player time
          if (video.state === 1) {
            time = this.calcNetworkPlayerTime(video.time, true);
          }

          // if the video doesn't have any state set the target for when the video is playing
          // NOTE: see client_playerStateChange
          if (typeof video.state === 'undefined') {
            video.state = YT.PlayerState.PLAYING;
          }

          console.log(`playing video at`, time);

          this.current = video;
          this.player.loadVideoById(video.videoId, time, 'default');
          document.title = `${video.title} - YouTube Sync`;

          // set the playback rate if we need to
          if (typeof video.rate !== 'undefined') {
            console.log(`playVideo - setting video playback rate to '${video.rate}'...`);
            this.player.setPlaybackRate(video.rate);
          }
        }
        else if (video && !(this.flags & PlayerFlags.Ready)) {
          console.warn(`playVideo - player isn't ready yet. video will start when playing is loaded.`);
          this.when_ready = video;
          this.flags |= PlayerFlags.Waiting;
        }
      },
      server_updatePlayerState({ state, time = 0 }) {
        if (!(this.flags & PlayerFlags.Ready)) {
          console.error(`server_updatePlayerState - YouTube player isn't ready yet!`);
        }

        if (this.current) {
          this.current.state = state;
        }

        console.log(`server_updatePlayerState`, state, time);

        if (state === YT.PlayerState.PLAYING) {
          this.player.playVideo();
          this.flags &= ~PlayerFlags.Paused;
        }
        else if (state === YT.PlayerState.PAUSED) {
          this.player.seekTo(time, true);
          this.player.pauseVideo();
          this.flags |= PlayerFlags.Paused;
        }
        else if (state === YT.PlayerState.ENDED) {
          this.player.stopVideo();
          this.flags |= PlayerFlags.Paused;
        }
      },
      server_updatePlaybackRate(data) {
        console.log(`update playback rate`);
        console.log(data);

        // if (!(this.flags & PlayerFlags.Ready)) {
        // }

        this.player.setPlaybackRate(data.rate);
      },
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
          this.video_to_queue = '';
          this.flags = 0;
          this.current = null;
          this.when_ready = null;
          this.resync_clock = false;
          this.ignore_player_state = true;

          // destroy the player
          if (prevflags & PlayerFlags.Ready) {
            this.player.destroy();
            this.client_createPlayer();
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
