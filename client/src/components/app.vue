<template>
  <div id="app">
    <h1>YouTube Sync</h1>
    <youtube-player></youtube-player>
  </div>
</template>

<script>
  import io from 'socket.io-client';
  import YouTubePlayer from './player.vue';

  export default {
    el: 'app',
    components: YouTubePlayer,
    data: () => ({
      socket: null,
    }),
    mounted() {
      this.socket = io('http://localhost:8888');

      // register client events
      //this.$on('send_queue_video', data => this.socket.emit('client_queue_video', data));
      //this.$on('send_update_video', data => this.socket.emit(`client_update_video_${data.type}`, data));
      this.$on('send', data => this.socket.emit(`client_${data.type}`, data));

      // register server events
      //this.socket.on('server_play_video', data => this.$emit('server_play_video', data));
      //this.socket.on('server_update_video', data => this.$emit('server_update_video', data));
      this.socket.on('recv', data => this.$emit(`server_${data.type}`, data));

      // TEMP: join the dev room
      this.socket.emit('room_join', 'dev');
    },
  };
</script>