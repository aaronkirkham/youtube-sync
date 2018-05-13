<template>
  <main class="player" id="player">
    <div class="player__iframe-container">
      <div id="player__iframe"></div>
    </div>
    <div class="style-input">
      <input type="text" class="input" placeholder="Paste a YouTube URL..." v-model="video_to_queue" @keyup.enter="client_requestVideo()" />
      <button type="submit" class="button" @click="client_requestVideo()">Queue</button>
    </div>
    <button @click="client_debugQueue()" style="margin-top:10px;">Queue Debug Videos</button>
  </main>
</template>

<script>
  import Vue from 'vue';
  import store from '../store';

  // player flags
  const PLY_READY = 1;
  const PLY_PAUSED = 2;
  const PLY_WAITING = 4;

  export default Vue.component('youtube-player', {
    data: () => ({
      player: null,
      video_to_queue: '',
      flags: 0,
      current: null,
      when_ready: null,
      resync_clock: false,
    }),
    created() {
      const script = document.createElement('script');
      script.setAttribute('async', true);
      script.setAttribute('src', 'https://youtube.com/iframe_api');

      document.head.appendChild(script);
    },
    mounted() {
      this.$root.$on('server__video--play', data => this.server_playVideo(data));
      this.$root.$on('server__video--update', data => {});
      this.$root.$on('server__video--state', data => this.server_updatePlayerState(data));
      this.$root.$on('server__video--playback-rate', data => this.server_updatePlaybackRate(data));
      this.$root.$on('server__room--update', data => this.server_playVideo(data.playing));

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
        if (this.is_host && this.current && ((this.flags & PLY_READY) && !(this.flags & PLY_PAUSED))) {
          this.$root.$emit('send', { type: 'video--clock', id: this.current.id, time: this.client_getNetworkPlayerTime() });
        }
      });

      // youtube iframe ready
      window.onYouTubeIframeAPIReady = () => {
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
        })
      };
    },
    methods: {
      // #######################################
      // ## CLIENT RELATED METHODS
      // #######################################
      client_playerReady() {
        console.log('PlayerReady');
        
        this.flags |= PLY_READY;

        // do we have a video ready to play?
        if (this.flags & PLY_WAITING) {
          this.server_playVideo(this.when_ready);
          this.when_ready = null;
          this.resync_clock = true;
          this.flags &= ~PLY_WAITING;
        }
      },
      client_playerStateChange(event) {
        // once the video has started playing, update the states if we need to
        if (event.data === YT.PlayerState.PLAYING) {
          console.log(`playerStateChange - client: ${event.data}, server: ${this.current.state}`);

          // if the current video state isn't playing, update it now
          if (typeof this.current.state !== 'undefined' && this.current.state !== YT.PlayerState.PLAYING) {
            this.server_updatePlayerState(this.current);
          }

          // resync the clock if we need to
          // if (!this.is_host && this.resync_clock && this.current.state === YT.PlayerState.PLAYING) {
          //   const time = this.calcNetworkPlayerTime(this.current, true);
          //   this.player.seekTo(time, true);
          //   this.resync_clock = false;

          //   console.log('resynced clock!');
          // }
        }

        // don't continue below unless we're the host and we're actually playing a video
        if (!this.is_host || !this.current || event.data === YT.PlayerState.BUFFERING) {
          return false;
        }

        console.log('PlayerStateChange', event.data);

        switch (event.data) {
          case YT.PlayerState.PLAYING: {
            this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.PLAYING, time: this.client_getNetworkPlayerTime() });
            this.flags &= ~PLY_PAUSED;
            break;
          }

          case YT.PlayerState.PAUSED: {
            this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.PAUSED, time: this.client_getNetworkPlayerTime() });
            this.flags |= PLY_PAUSED;
            break;
          }

          case YT.PlayerState.ENDED: {
            this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.ENDED });
            this.flags |= PLY_PAUSED;
            break;
          }
        }
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
          // TODO: error?
          return;
        }

        // make sure we have a valid id in the video url
        if (typeof url_segments[2] !== 'undefined' && url_segments[2].length === 0) {
          // TODO: error?
          return;
        }

        console.log('requesting video', this.video_to_queue);

        // fetch some basic information about the video
        fetch(`https://noembed.com/embed?url=${this.video_to_queue}`, { method: 'get' })
          .then(response => response.json())
          .then(data => {
            console.log(data);

            const video_obj = {
              video_id: url_segments[2],
              title: data.title,
              url: data.url,
              thumbnail: data.thumbnail_url,
            };

            // send to the server if we are connected
            if (this.is_online) {
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
        if (!(this.flags & PLY_READY)) {
          return 0;
        }

        return (this.player.getCurrentTime() + (this.ping / 1000));
      },
      client_debugQueue() {
        this.$root.$emit('send', {
          type: 'queue--add',
          video_id: 'oySqE3z99AE',
          title: 'Hybrid Minds - Inside (ft. Emily Jones)',
          url: 'https://www.youtube.com/watch?v=oySqE3z99AE',
          thumbnail: 'https://i.ytimg.com/vi/oySqE3z99AE/hqdefault.jpg',
        });

        this.$root.$emit('send', {
          type: 'queue--add',
          video_id: 'JSxCc2e3BEE',
          title: 'Hybrid Minds - Liquicity Winterfestival 2017',
          url: 'https://www.youtube.com/watch?v=JSxCc2e3BEE',
          thumbnail: 'https://i.ytimg.com/vi/JSxCc2e3BEE/hqdefault.jpg',
        });

        this.$root.$emit('send', {
          type: 'queue--add',
          video_id: '-fCtvurGDD8',
          title: 'Birdy - Wings (Nu:Logic Remix)',
          url: 'https://www.youtube.com/watch?v=-fCtvurGDD8',
          thumbnail: 'https://i.ytimg.com/vi/-fCtvurGDD8/hqdefault.jpg',
        });
      },






      // #######################################
      // ## SERVER RELATED METHODS
      // #######################################
      server_playVideo(video) {
        if (video && (this.flags & PLY_READY)) {
          console.log('playVideo', video);

          let time = video.time ? video.time : 0;

          // if the video is playing, calculate the network player time
          if (true || video.state === 1) {
            time = this.calcNetworkPlayerTime(video.time, true);
          }

          console.log(`playing video at`, time);

          this.current = video;
          this.player.loadVideoById(video.video_id, time, 'default');
          document.title = `${video.title} - YouTube Sync`;

          // set the playback rate if we need to
          if (typeof video.rate !== 'undefined') {
            console.log(`playVideo - setting video playback rate to '${video.rate}'...`);
            this.player.setPlaybackRate(video.rate);
          }
        }
        else if (video && !(this.flags & PLY_READY)) {
          console.warn(`playVideo - player isn't ready yet. video will start when playing is loaded.`);
          this.when_ready = video;
          this.flags |= PLY_WAITING;
        }
      },
      server_updatePlayerState({ state, time = 0 }) {
        if (!(this.flags & PLY_READY)) {
          console.error(`youtube player isn't ready yet!`);
        }

        console.log(state,time);

        this.current.state = state;
        
        switch (state) {
          case YT.PlayerState.PLAYING: {
            if (this.flags & PLY_PAUSED) {
              //this.player.seekTo(this.calcNetworkPlayerTime(time, true), true);
              this.player.playVideo();
              this.flags &= ~PLY_PAUSED;

              console.log('video playing!');
            }

            break;
          }

          case YT.PlayerState.PAUSED: {
            if (!(this.flags & PLY_PAUSED)) {
              this.player.pauseVideo();
              setTimeout(() => this.player.seekTo(this.calcNetworkPlayerTime(time, true), true), 100);
              this.flags |= PLY_PAUSED;

              console.log('video paused!');
            }

            break;
          }

          case YT.PlayerState.ENDED: {
            this.player.stopVideo();
            console.log('video is ended!');
            break;
          }
        }
      },
      server_updatePlaybackRate(data) {
        console.log(`update playback rate`);
        console.log(data);

        if (!(this.flags & PLY_READY)) {
        }

        this.player.setPlaybackRate(data.rate);
      },
      calcNetworkPlayerTime(time, ignore_delta = false) {
        console.log(`calcNetworkPlayerTime(${time})`);

        time = (time + (this.ping / 1000));
        const delta = Math.abs(time - this.player.getCurrentTime());
        console.log(` delta: ${delta}`);

        if (!ignore_delta && delta < 0.6) {
          return false;
        }

        return time;
      },
    },
    computed: {
      is_online: () => store.state.is_online,
      is_host: () => store.state.im_the_host,
      ping: () => store.state.latest_ping,
    },
  });
</script>