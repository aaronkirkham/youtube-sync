<template>
  <div id="app">
    <header class="primary-header" role="banner">
      <h1 class="logo">YouTube Sync</h1>
      <search></search>
    </header>
    <player></player>
    <queue></queue>
  </div>
</template>

<script>
  import store from '../store';
  import io from 'socket.io-client';

  import Player from './player';
  import Queue from './queue';
  import Search from './search';

  export default {
    el: '#app',
    store,
    components: {
      Player, Queue, Search,
    },
    data() {
      return {
        socket: null,
        root: null,
      };
    },
    mounted() {
      let url = process.env.MODE === 'development' ? 'http://localhost:8888' : 'https://youtube-sync-server.herokuapp.com';

      // if we passed a custom socket url to the build, use that instead.
      if (typeof process.env.SOCKET_URL !== 'undefined') {
        url = process.env.SOCKET_URL;
      }

      // figure out the root path
      // NOTE: if the client is in a subdirectory, we need to push to the correct relative path later.
      const { pathname } = document.location;
      this.root = pathname.substr(0, pathname.lastIndexOf('/') + 1);

      this.socket = io(url); // { reconnection: false, query: `timestamp=${Date.now()}` }
      this.socket.on('connect', () => this.$store.commit('setOnline', true));
      this.socket.on('disconnect', (reason) => {
        this.$store.commit('setOnline', false);
        this.$store.commit('setHost', false);

        // if the server is shutting down
        if (reason === 'transport close') {
          history.replaceState(null, null, this.root);
        }
      });

      // manually disconnect the socket before the window unloads
      window.onbeforeunload = () => {
        this.socket.disconnect();
      };

      if (process.env.MODE === 'development') {
        this.socket.on('connect_error', err => console.error(err));
      }

      // register send events
      this.$on('send', data => this.socket.emit(`client__${data.type}`, data));
      this.$on('server__im_the_host', () => this.$store.commit('setHost', true));
      this.$on('server__update_url', data => history.replaceState(null, null, data.id));

      // register receive events
      this.socket.on('recv', data => this.$emit(`server__${data.type}`, data));

      // broadcast the pong event
      this.socket.on('pong', ms => {
        this.$store.commit('setPing', ms);
        this.$emit('server__pong', ms);
      });
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
    overscroll-behavior: none none;
  }

  input,
  button {
    font-family: 'PT Sans', sans-serif;
    font-weight: 400;
  }

  #app {
    display: grid;
    grid-gap: 50px;
    grid-template-columns: auto auto 30%;
  }

  .primary-header {
    position: relative;
    grid-column: 1 / 4;
    display: flex;
    align-items: center;
  }
</style>
