<template>
  <div id="player">
    <!--<h3 class="player__title" v-if="playing">{{ playing.title }}</h3>-->
    <div class="grid">
      <div class="col-8">
        <!-- primary iframe container -->
        <div class="player__iframe-container">
          <div id="player__iframe"></div>
        </div>
        <!-- room stats -->
        <!--<div class="grid align-center justify-space-between player__stats">
          <div class="col-auto">
            <span class="stats__current-playing">{{ playing && playing.title }}</span>
          </div>
          <div class="col-auto text-align--right">
            <span class="stats__current-watching" title="5 watching">
              <svg width="14" height="14" viewBox="0 0 1792 1792" xmlns="http://www.w3.org/2000/svg">
                <path d="M1664 960q-152-236-381-353 61 104 61 225 0 185-131.5 316.5t-316.5 131.5-316.5-131.5-131.5-316.5q0-121 61-225-229 117-381 353 133 205 333.5 326.5t434.5 121.5 434.5-121.5 333.5-326.5zm-720-384q0-20-14-34t-34-14q-125 0-214.5 89.5t-89.5 214.5q0 20 14 34t34 14 34-14 14-34q0-86 61-147t147-61q20 0 34-14t14-34zm848 384q0 34-20 69-140 230-376.5 368.5t-499.5 138.5-499.5-139-376.5-368q-20-35-20-69t20-69q140-229 376.5-368t499.5-139 499.5 139 376.5 368q20 35 20 69z" fill="#ff0000"/>
              </svg>
              5
            </span>
          </div>
        </div>-->
        <!-- queue video controls -->
        <div class="grid player__controls">
          <div class="col-10">
            <input type="input" class="input" placeholder="Paste a YouTube URL..." v-model="video_to_queue" />
          </div>
          <div class="col-2">
            <input type="submit" @click="requestVideo()" />
          </div>
        </div>
      </div>
      <!-- sidebar -->
      <div class="col-4">
        <ul class="player__queue-container">
          <li v-for="video in queue" v-bind:key="video.id" class="player__queue-item">
            <div class="player__queue-item-thumbnail-container">
              <img v-bind:src="video.thumbnail" class="player__queue-item-thumbnail" />
            </div>
            <p class="player__queue-item-title">{{ video.title }}</p>
          </li>
        </ul>
      </div>
    </div>
  </div>
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

      for (let i = 0; i < 5; i++) {
        this.queue.push({
          id: '8GW6sLrK40k',
          title: 'HOME - Resonance',
          thumbnail: 'https://i.ytimg.com/vi/8GW6sLrK40k/hqdefault.jpg'
        });
      }
    },
    mounted() {
      this.$root.$on('server_play_video', video => this.playVideo(video));
      this.$root.$on('server_add_to_queue', video => this.queue.push(video));
      this.$root.$on('server_remove_from_queue', data => this.queue = this.queue.filter(video => video.id !== data.id));
      this.$root.$on('server_update_room_info', data => {
        this.playVideo(data.playing);
        this.queue = data.queue;
      });

      this.$root.$on('server_update_state', data => this.updatePlayerState(data.state));

      this.$root.$on('server_update_clock', data => {
        console.log('server_update_clock', data);

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

          this.player.obj.loadVideoById(video.id, video.time ? video.time : 0, 'default');
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
                  type: 'update_clock',
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
            this.$root.$emit('send', { type: 'update_video', state: YT.PlayerState.PLAYING, time: this.player.obj.getCurrentTime(), timestamp: Date.now() });
            break;
          }

          case YT.PlayerState.PAUSED: {
            this.$root.$emit('send', { type: 'update_video', state: YT.PlayerState.PAUSED, time: this.player.obj.getCurrentTime(), timestamp: 0 });
            break;
          }

          case YT.PlayerState.ENDED: {
            this.$root.$emit('send', { type: 'update_video', state: YT.PlayerState.ENDED, time: 0, timestamp: 0 });
            break;
          }
        }
      },
      playerPlaybackRateChange(event) {
        console.log('PlayerPlaybackRateChange');

        this.$root.$emit('send', {
          type: 'update_video_playback_rate',
          rate: event.data
        });
      },
      requestVideo() {
        console.log('requesting video', this.video_to_queue);

        // make sure the input url is valid
        const url_segments = this.video_to_queue.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);

        // fetch some basic information about the video
        fetch(`https://noembed.com/embed?url=${this.video_to_queue}`, { method: 'get' })
          .then(response => response.json())
          .then(data => {
            console.log(data);
            
            this.$root.$emit('send', {
              type: 'queue_video',
              id: url_segments[2],
              title: data.title,
              url: data.url,
              thumbnail: data.thumbnail_url,
            });
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
      }
    },
    computed: {
      is_host: () => store.state.im_the_host,
    }
  });
</script>