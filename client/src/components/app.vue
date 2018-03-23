<template>
  <div id="app">
    <header class="primary-header" role="banner">
      <div class="container">
        <h1 class="logo">YouTube Sync</h1>
      </div>
    </header>
    <router-view></router-view>
  </div>
</template>

<script>
  import store from '../store';
  import router from '../router';
  import io from 'socket.io-client';

  export default {
    el: 'app',
    router,
    data: () => ({
      socket: null,
    }),
    mounted() {
      this.socket = io('http://localhost:8888'); // { reconnection: false, reconnectionDelay: 5000 });
      this.socket.on('disconnect', () => router.push('/'));
      // this.socket.on('connect_error', () => console.log('failed to connect to the server!'));

      // TODO: on disconnect, clean up the store stuff
      //        make sure is_online is false
      //        make sure im_the_host is false

      // register send/receive events
      this.$on('send', data => this.socket.emit(`client__${data.type}`, data));
      this.socket.on('recv', data => this.$emit(`server__${data.type}`, data));
      this.$on('server__im_the_host', () => store.commit('IM_THE_HOST', true));
      this.$on('server__update_url', data => router.push(data.id));

      // TEMP: join the dev room
      //this.socket.emit('room_join', 'dev');
    },
    computed: {
      is_online: () => store.state.is_online,
    },
  };
</script>