<template>
  <div id="app">
    <header class="primary-header" role="banner">
      <div class="container">
        <h1 class="logo">YouTube Sync</h1>
      </div>
    </header>
    <main class="primary-main" role="main">
      <div class="container">
        <youtube-player></youtube-player>
      </div>
    </main>
  </div>
</template>

<script>
  import store from '../store';
  import io from 'socket.io-client';
  import YouTubePlayer from './player.vue';

  export default {
    el: 'app',
    components: YouTubePlayer,
    data: () => ({
      socket: null,
    }),
    mounted() {
      this.socket = io('http://localhost:8888'); // { reconnection: false, reconnectionDelay: 5000 });
      //this.socket.on('connect_error', () => console.log('failed to connect to the server!'));

      // register send/receive events
      this.$on('send', data => this.socket.emit(`client_${data.type}`, data));
      this.socket.on('recv', data => this.$emit(`server_${data.type}`, data));
      this.$on('server_im_the_host', () => store.commit('IM_THE_HOST', true));

      // TEMP: join the dev room
      this.socket.emit('room_join', 'dev');
    },
  };
</script>