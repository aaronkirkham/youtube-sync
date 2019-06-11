<template>
  <div id="app">
    <header class="primary-header" role="banner">
      <div class="container">
        <h1 class="logo">YouTube Sync<span v-if="!isOnline"> (OFFLINE)</span></h1>
      </div>
    </header>
    <router-view></router-view>
    <table class="debug-view" style="font-size:16px;" v-if="showDebugView">
      <tr>
        <td>Ping (ms):</td>
        <td>{{ ping }}</td>
      </tr>
      <tr>
        <td>Is Host:</td>
        <td>{{ isHost ? 'Yes' : 'No' }}</td>
      </tr>
      <tr>
        <td>Player Delta:</td>
        <td :style="{ color: playerDeltaColour() }">{{ delta.toFixed(4) }}</td>
      </tr>
    </table>
  </div>
</template>

<script>
  import store from '../store';
  import router from '../router';
  import io from 'socket.io-client';

  export default {
    el: 'app',
    store,
    router,
    data: () => ({ 
      socket: null,
      delta: 0,
    }),
    mounted() {
      this.socket = io('http://localhost:8888');//, { reconnection: false, query: `timestamp=${Date.now()}` });
      this.socket.on('connect', () => this.$store.commit('setOnline', true));
      this.socket.on('disconnect', () => {
        this.$store.commit('setOnline', false);
        this.$store.commit('setHost', false);

        router.push('/');
      });

      // register send events
      this.$on('send', data => this.socket.emit(`client__${data.type}`, data));
      this.$on('server__im_the_host', () => this.$store.commit('setHost', true));
      this.$on('server__update_url', data => router.push(data.id));

      // register receive events
      this.socket.on('recv', data => this.$emit(`server__${data.type}`, data));

      // broadcast the pong event
      this.socket.on('pong', ms => {
        this.$store.commit('setPing', ms);
        this.$emit(`server__pong`, ms);
      });

      //
      this.$on('debugPlayerDelta', delta => this.delta = delta);
    },
    methods: {
      playerDeltaColour() {
        if (this.delta > 0.4) return 'rgb(255, 0, 0)'
        else if (this.delta > 0.25) return 'rgb(255, 69, 0)';
        return 'rgb(255, 255, 255)';
      },
    },
    computed: {
      isOnline: () => store.state.online,
      isHost: () => store.state.host,
      ping: () => store.state.ping,
      showDebugView: () => process.env.mode === 'development',
    },
  };
</script>
