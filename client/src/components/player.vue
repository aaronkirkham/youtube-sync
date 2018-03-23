<template>
  <main class="player" role="main" id="player">
    <div class="player__iframe-container">
      <div id="player__iframe"></div>
    </div>
    <div class="style-input">
      <input type="text" class="input" placeholder="Paste a YouTube URL..." v-model="video_to_queue" @keyup.enter="requestVideo()" />
      <button type="submit" class="button" @click="requestVideo()">Queue</button>
    </div>
  </main>
</template>

<script>
  import Vue from 'vue';
  import store from '../store';

  export default Vue.component('youtube-player', {
    data: () => ({
      player: {
        obj: null,
        is_ready: false,
        is_paused: false,
      },
      playing: null,
      play_when_ready: null,
      queue: [],
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

        if (this.playing.id === data.id) {
          if (data.timestamp && data.timestamp !== 0) {
            console.log(`synced ~${Date.now() - data.timestamp}ms ago...`);

            // extrapolate the player time to compensate for the ping
            data.time += (Math.abs(Date.now() - data.timestamp) / 1000);
            console.log(` - extrapolated: ${data.time}`);
            console.log(` - error: ${data.time - this.player.obj.getCurrentTime()}`);

            if ((data.time - this.player.obj.getCurrentTime()) > 0.5) {
              this.player.obj.seekTo(data.time, true);
              console.log('synced player');
            }
          }
          else {
            this.player.obj.seekTo(data.time, true);
          }
        }
        else {
          console.warn('got clock update for a different video!', data.id, this.playing.id);
        }
      })

      // youtube iframe ready
      window.onYouTubeIframeAPIReady = () => {
        this.player.obj = new YT.Player('player__iframe', {
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
        if (video && this.player.is_ready) {
          console.log('playing video', video);

          this.player.obj.loadVideoById(video.video_id, video.time ? video.time : 0, 'default');
          this.playing = video;
          this.play_when_ready = null;
          document.title = `${video.title} - YouTube Sync`;

          // set the playback rate if we need to
          if (typeof video.rate !== 'undefined') {
            console.log('updating playback rate to', video.rate);
            this.player.obj.setPlaybackRate(video.rate);
          }

          // are we the host of this room?
          if (this.is_host) {
            if (this.clock.timer) {
              clearInterval(this.clock.timer);
            }

            // start the clock to sync the video
            this.clock.timer = setInterval(() => {
              if (!this.player.is_paused) {
                this.$root.$emit('send', {
                  type: 'video--clock',
                  id: this.playing.id,
                  time: this.player.obj.getCurrentTime(),
                  timestamp: Date.now()
                });
              }
            }, this.clock.resolution);
          }
        }
        else if (video && !this.player.is_ready) {
          console.warn('video will start when player is loaded...');
          this.play_when_ready = video;
        }
      },
      playerReady(event) {
        console.log('PlayerReady');
        
        this.player.is_ready = true;

        // do we have a video ready to play?
        if (this.play_when_ready) {
         this.playVideo(this.play_when_ready);
        }
      },
      playerStateChange(event) {
        // if we're not the host and the video has started playing, update the states if we need to
        if (!this.is_host && event.data === YT.PlayerState.PLAYING) {
          console.log('playing (state change):', this.playing);

          if (typeof this.playing.state !== 'undefined' && this.playing.state !== YT.PlayerState.PLAYING) {
            this.updatePlayerState(this.playing.state);
          }
        }

        // don't continue below unless we're the host and we're actually playing a video
        if (!this.is_host || !this.playing || event.data === YT.PlayerState.BUFFERING) {
          return false;
        }

        console.log('PlayerStateChange', event.data);

        switch (event.data) {
          case YT.PlayerState.PLAYING: {
            this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.PLAYING, time: this.player.obj.getCurrentTime(), timestamp: Date.now() });
            break;
          }

          case YT.PlayerState.PAUSED: {
            this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.PAUSED, time: this.player.obj.getCurrentTime(), timestamp: 0 });
            break;
          }

          case YT.PlayerState.ENDED: {
            this.$root.$emit('send', { type: 'video--update', state: YT.PlayerState.ENDED, time: 0, timestamp: 0 });
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
            
            this.$root.$emit('send', {
              type: 'queue--add',
              video_id: url_segments[2],
              title: data.title,
              url: data.url,
              thumbnail: data.thumbnail_url,
            });

            this.video_to_queue = '';
          })
          .catch(err => console.error(err));
      },
      updatePlayerState(state) {
        if (!this.player.is_ready) {
          console.error(`player isn't ready yet!`);
        }

        this.playing.state = state;
        
        switch (state) {
          case YT.PlayerState.PLAYING: {
            if (this.player.is_paused) {
              this.player.obj.playVideo();
              this.player.is_paused = false;
            }

            break;
          }

          case YT.PlayerState.PAUSED: {
            if (!this.player.is_paused) {
              this.player.obj.pauseVideo();
              this.player.is_paused = true;
            }

            break;
          }

          case YT.PlayerState.ENDED: {
            this.player.obj.stopVideo();
            break;
          }
        }
      },
      changeVideo(video) {
        console.log(`requesting change to "${video.title}" (${video.id})...`);
        this.$root.$emit('send', { type: 'video--change', id: video.id });
      },
    },
    computed: {
      is_host: () => store.state.im_the_host,
    }
  });
</script>