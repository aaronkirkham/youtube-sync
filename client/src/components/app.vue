<template>
  <div id="app">
    <header class="primary-header" role="banner">
      <div class="container">
        <h1 class="logo">YouTube Sync <span v-if="!is_online">(OFFLINE)</span></h1>
      </div>
    </header>
    <router-view></router-view>
  </div>
</template>

<script>
  import store from '../store';
  import router from '../router';
  import io from 'socket.io-client';

  // testing broken clocks
  // TODO: Remove when it's all working.
  Date.now = function now() {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return d.getTime();
  }

  export default {
    el: 'app',
    router,
    data: () => ({ 
      socket: null,
    }),
    mounted() {
      // 146.199.236.232
      this.socket = io('http://localhost:8888', { reconnection: false, query: `timestamp=${Date.now()}` });
      this.socket.on('connect', () => store.commit('TOGGLE_ONLINE', true));
      this.socket.on('disconnect', () => {
        store.commit('TOGGLE_ONLINE', false);
        store.commit('IM_THE_HOST', false);
        router.push('/');
      });
      // this.socket.on('connect_error', () => console.log('failed to connect to the server!'));

      // register send events
      this.$on('send', data => this.socket.emit(`client__${data.type}`, data));
      this.$on('server__im_the_host', () => store.commit('IM_THE_HOST', true));
      this.$on('server__update_url', data => router.push(data.id));

      // register receive events
      this.socket.on('recv', data => this.$emit(`server__${data.type}`, data));

      // TEMP: join the dev room
      //this.socket.emit('room_join', 'dev');
    },
    computed: {
      is_online: () => store.state.is_online,
    },
  };
</script>