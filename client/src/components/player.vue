<template>
  <div id="player">
    <h3 class="player__title" v-if="playing">{{ playing.title }}</h3>
    <div id="player__iframe"></div>
    <div class="player__things">
      <input type="input" v-model="video_to_queue" />
      <input type="submit" @click="requestVideo()" />
    </div>
  </div>
</template>

<script>
  import Vue from 'vue';

  export default Vue.component('youtube-player', {
    data: () => ({
      player: {
        obj: null,
        is_ready: false,
      },
      playing: null,
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
      });

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
        console.log('PlayerStateChange');

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
  });
</script>