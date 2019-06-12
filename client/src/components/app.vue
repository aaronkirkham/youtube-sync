<template>
  <div id="app">
    <!-- <header class="primary-header" role="banner">
      <div class="container">
        <h1 class="logo">YouTube Sync<span v-if="!isOnline"> (OFFLINE)</span></h1>
      </div>
    </header> -->
    <router-view></router-view>
    <debug-view v-if="showDebugView"></debug-view>
  </div>
</template>

<script>
  import store from '../store';
  import router from '../router';
  import io from 'socket.io-client';

  import DebugView from './debug';

  export default {
    el: 'app',
    store,
    router,
    components: {
      DebugView
    },
    data() {
      return {
        socket: null,
      };
    },
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
    },
    computed: {
      showDebugView: () => process.env.mode === 'development',
    },
  };
</script>

<style lang="scss">
  @import '~normalize.css/normalize.css';

  * {
    box-sizing: border-box;
  }

  html, body {
    height: 100vh;
  }

  body {
    background-image: radial-gradient(circle at 0% 0%, #373b52, #252736 51%, #1d1e26);
    font-family: 'PT Sans', sans-serif;
    font-weight: 700;
    color: #ffffff;
    padding: 25px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior-y: none;
  }

  #app {
    display: grid;
    grid-gap: 50px;
    grid-template-columns: auto auto 30%;
  }
</style>
