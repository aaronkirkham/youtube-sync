<template>
  <main class="player" id="player">
    <div class="player__iframe-container">
      <div id="player__iframe"></div>
    </div>
    <div class="style-input">
      <input type="text" class="input" placeholder="Paste a YouTube URL..." v-model="video_to_queue" @keyup.enter="requestVideo()" />
      <button type="submit" class="button" @click="requestVideo()">Queue</button>
      <button type="button" class="button" @click="debugQueue()">Debug Queue</button>
    </div>
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
      flags: 0,
      current: null,
      when_ready: null,
      video_to_queue: 'https://www.youtube.com/watch?v=oySqE3z99AE',
      clock: {
        timer: null,
        resolution: 3000, // sync the clocks every 3 seconds
      },
    }),
    created() {
      const script = document.createElement('script');
      script.setAttribute('async', true);
      script.setAttribute('src', 'https://youtube.com/iframe_api');

      document.head.appendChild(script);
    },
    mounted() {
      this.$root.$on('server__video--play', data => this.playVideo(data));
      this.$root.$on('server__video--update', data => {});
      this.$root.$on('server__video--state', data => this.updatePlayerState(data.state));
      this.$root.$on('server__room--update', data => this.playVideo(data.playing));

      this.$root.$on('server__video--clock', data => {
        console.log('server__video--clock', data);

        // we don't care about this if we're the host
        // if (this.is_host) {
        //   console.error(`got clock update but we're the host!`);
        //   return false;
        // }

        if (this.current.id === data.id) {
          if (data.timestamp && data.timestamp !== 0) {
            console.log(`synced ~${Date.now() - data.timestamp}ms ago...`);

            // extrapolate the player time to compensate for the ping
            data.time += (Math.abs(Date.now() - data.timestamp) / 1000);
            console.log(` - extrapolated: ${data.time}`);
            console.log(` - diff from player: ${data.time - this.player.getCurrentTime()}`);

            // TODO: this doesn't work if you seek backwards
            if ((data.time - this.player.getCurrentTime()) > 0.5) {
              this.player.seekTo(data.time, true);
              console.log('synced player');
            }
          }
          else {
            this.player.seekTo(data.time, true);
          }
        }
        else {
          console.warn('got clock update for a different video!', data.id, this.current.id);
        }
      })

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
            'onReady': this.playerReady,
            'onStateChange': this.playerStateChange,
            'onPlaybackRateChange': this.playerPlaybackRateChange,
          },
        })
      };
    },
    methods: {
      playVideo(video) {
        if (video && (this.flags & PLY_READY)) {
          console.log('playing video', video);

          this.player.loadVideoById(video.video_id, video.time ? video.time : 0, 'default');
          this.current = video;
          document.title = `${video.title} - YouTube Sync`;

          // set the playback rate if we need to
          if (typeof video.rate !== 'undefined') {
            console.log('updating playback rate to', video.rate);
            this.player.setPlaybackRate(video.rate);
          }

          // are we the host of this room?
          if (this.is_online && this.is_host) {
            if (this.clock.timer) {
              clearInterval(this.clock.timer);
            }

            // start the clock to sync the video
            this.clock.timer = setInterval(() => {
              if (!(this.flags & PLY_PAUSED)) {
                this.$root.$emit('send', {
                  type: 'video--clock',
                  id: this.current.id,
                  time: this.player.getCurrentTime(),
                  timestamp: Date.now()
                });
              }

            }, this.clock.resolution);
          }
        }
        else if (video && !(this.flags & PLY_READY)) {
          console.warn('video will start when player is loaded...');
          this.when_ready = video;
          this.flags |= PLY_WAITING;
        }
      },
      playerReady(event) {
        console.log('PlayerReady');
        
        this.flags |= PLY_READY;

        // do we have a video ready to play?
        if (this.flags & PLY_WAITING) {
          this.playVideo(this.when_ready);
          this.when_ready = null;
          this.flags &= ~PLY_WAITING;
        }
      },
      playerStateChange(event) {
        // if we're not the host and the video has started playing, update the states if we need to
        if (!this.is_host && event.data === YT.PlayerState.PLAYING) {
          console.log('playing (state change):', this.current);

          if (typeof this.current.state !== 'undefined' && this.current.state !== YT.PlayerState.PLAYING) {
            this.updatePlayerState(this.current.state);
          }
        }

        // don't continue below unless we're the host and we're actually playing a video
        if (!this.is_host || !this.current || event.data === YT.PlayerState.BUFFERING) {
          return false;
        }

        console.log('PlayerStateChange', event.data);

        switch (event.data) {
          case YT.PlayerState.PLAYING: {
            this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.PLAYING, time: this.player.getCurrentTime(), timestamp: Date.now() });

            this.flags &= ~PLY_PAUSED;
            break;
          }

          case YT.PlayerState.PAUSED: {
            this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.PAUSED, time: this.player.getCurrentTime(), timestamp: Date.now() });

            this.flags |= PLY_PAUSED;
            break;
          }

          case YT.PlayerState.ENDED: {
            this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.ENDED, time: 0, timestamp: Date.now() });
            break;
          }
        }
      },
      playerPlaybackRateChange(event) {
        console.log('PlayerPlaybackRateChange');

        this.$root.$emit('send', {
          type: 'video--playback-rate',
          rate: event.data
        });
      },
      requestVideo() {
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
      updatePlayerState(state) {
        if (!(this.flags & PLY_READY)) {
          console.error(`youtube player isn't ready yet!`);
        }

        this.current.state = state;
        
        switch (state) {
          case YT.PlayerState.PLAYING: {
            if (this.flags & PLY_PAUSED) {
              this.player.playVideo();
              this.flags &= ~PLY_PAUSED;
            }

            break;
          }

          case YT.PlayerState.PAUSED: {
            if (!(this.flags & PLY_PAUSED)) {
              this.player.pauseVideo();
              this.flags |= PLY_PAUSED;
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
      changeVideo(video) {
        console.log(`requesting change to "${video.title}" (${video.id})...`);
        this.$root.$emit('send', { type: 'video--change', id: video.id });
      },
      debugQueue() {
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
    },
    computed: {
      is_online: () => store.state.is_online,
      is_host: () => store.state.im_the_host,
    },
  });
</script>