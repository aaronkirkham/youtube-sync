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
          <h3 class="player__queue-title">Videos Queued ({{ queue.length }})</h3>
          <li v-for="video in queue" v-bind:key="video.id" class="player__queue-item">
            <div class="grid align-center">
              <div class="col-3">
                <img v-bind:src="video.thumbnail" class="player__queue-item-thumbnail" />
              </div>
              <div class="col-auto">
                <p class="player__queue-item-title">{{ video.title }}</p>
              </div>
            </div>
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
      },
      playing: null,
      queue: [],
      video_to_queue: 'https://www.youtube.com/watch?v=tEcggRukZCs',
    }),
    created() {
      const script = document.createElement('script');
      script.setAttribute('async', true);
      script.setAttribute('src', 'https://youtube.com/iframe_api');

      document.head.appendChild(script);
    },
    mounted() {
      // server related events
      this.$root.$on('server_play_video', video => {
        console.log('server requested video', video.title);

        this.playing = video;

        // load the video
        this.player.obj.loadVideoById(video.id, 0, 'default');

        // update the window title
        document.title = `${video.title} - YouTube Sync`;
      });

      this.$root.$on('server_add_to_queue', video => this.queue.push(video));
      this.$root.$on('server_remove_from_queue', id => this.queue = this.queue.filter(video => video.id !== id));

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
      playerReady(event) {
        console.log('PlayerReady');
        
        this.player.is_ready = true;
      },
      playerStateChange(event) {
        console.log('PlayerStateChange', event);

        // has the current video playing ended?
        if (event.data === YT.PlayerState.ENDED && this.is_host && this.playing) {
          this.$root.$emit('send', { type: 'video_ended' });
          return true;
        }

        // are we sat waiting for the iframe to load?
        if (event.data === YT.PlayerState.PLAYING && false) {
          // TODO
          return true;
        }

        this.$root.$emit('send', {
          type: 'update_video',
          state: event.data,
          time: this.player.obj.getCurrentTime()
        });
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
      }
    },
    computed: {
      is_host: () => store.state.im_the_host,
    }
  });
</script>