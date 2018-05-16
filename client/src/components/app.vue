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

  export default {
    el: 'app',
    router,
    data: () => ({ 
      socket: null,
    }),
    mounted() {
      this.socket = io('http://localhost:8888');//, { reconnection: false, query: `timestamp=${Date.now()}` });
      this.socket.on('connect', () => store.commit('TOGGLE_ONLINE', true));
      this.socket.on('disconnect', () => {
        store.commit('TOGGLE_ONLINE', false);
        store.commit('IM_THE_HOST', false);
        router.push('/');
      });

      // register send events
      this.$on('send', data => this.socket.emit(`client__${data.type}`, data));
      this.$on('server__im_the_host', () => store.commit('IM_THE_HOST', true));
      this.$on('server__update_url', data => router.push(data.id));

      // register receive events
      this.socket.on('recv', data => this.$emit(`server__${data.type}`, data));

      // broadcast the pong event
      this.socket.on('pong', ms => {
        store.commit('SET_LATEST_PING', ms);
        this.$emit(`server__pong`, ms);
      });
    },
    computed: {
      is_online: () => store.state.is_online,
    },
  };
</script>