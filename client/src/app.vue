<template>
  <div id="app" :class="{ 'connecting': !isOnline }">
    <header class="primary-header" role="banner">
      <h1 class="logo">YouTube Sync</h1>
      <SearchBox />
    </header>
    <YoutubePlayer />
    <PlayerQueue />
    <div v-if="!isOnline" class="spinner">
      <!-- By Sam Herbert (@sherb), for everyone. More @ http://goo.gl/7AJzbL -->
      <svg width="84" height="84" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="a" x1="8.042%" y1="0%" x2="65.682%" y2="23.865%">
            <stop stop-color="#fff" stop-opacity="0" offset="0%" />
            <stop stop-color="#fff" stop-opacity=".631" offset="63.146%" />
            <stop stop-color="#fff" offset="100%" />
          </linearGradient>
        </defs>
        <g fill="none" fill-rule="evenodd">
          <g transform="translate(1 1)">
            <path id="Oval-2" d="M36 18c0-9.94-8.06-18-18-18" stroke="url(#a)" stroke-width="2">
              <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite" />
            </path>
            <circle fill="#fff" cx="36" cy="18" r="1">
              <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite" />
            </circle>
          </g>
        </g>
      </svg>
      <h2 class="spinner__status">{{ connectStatus }}</h2>
      <h3 v-if="connectError" class="spinner__error">{{ connectError }}</h3>
    </div>
  </div>
</template>

<script>
  import { mapState } from 'vuex';
  import io from 'socket.io-client';
  import YoutubePlayer from './components/player.vue';
  import PlayerQueue from './components/queue.vue';
  import SearchBox from './components/search.vue';

  export default {
    components: { YoutubePlayer, PlayerQueue, SearchBox },
    data() {
      return {
        socket: null,
        connectStatus: 'Connecting to server...',
        connectError: null,
        rootPath: null,
      };
    },
    computed: mapState({
      isOnline: state => state.online,
    }),
    mounted() {
      let url = process.env.MODE === 'development' ? 'http://localhost:8888' : 'https://youtube-sync-server.herokuapp.com';

      // if we passed a custom socket url to the build, use that instead.
      if (typeof process.env.SOCKET_URL !== 'undefined') {
        url = process.env.SOCKET_URL;
      }

      // figure out the root path
      // NOTE: if the client is in a subdirectory, we need to push to the correct relative path later.
      const { pathname } = document.location;
      this.rootPath = pathname.substr(0, pathname.lastIndexOf('/') + 1);

      this.socket = io(url); // { reconnection: false, query: `timestamp=${Date.now()}` }
      this.socket.on('connect', () => this.$store.commit('setOnline', true));

      // update connect status messages
      this.socket.on('connect_error', (err) => { this.connectError = `${err.type}: ${err.message}`; });
      this.socket.on('reconnect_attempt', (attempt) => { this.connectStatus = `Connecting to server (${attempt})...`; });

      this.socket.on('disconnect', (reason) => {
        this.$store.commit('setOnline', false);
        this.$store.commit('setHost', false);

        // if the server is shutting down
        if (reason === 'transport close') {
          window.history.replaceState(null, null, this.rootPath);
        }
      });

      // manually disconnect the socket before the window unloads
      window.onbeforeunload = () => {
        this.socket.disconnect();
      };

      // register send events
      this.$root.$on('send', data => this.socket.emit(`client__${data.type}`, data));
      this.$root.$on('server__im_the_host', () => this.$store.commit('setHost', true));
      this.$root.$on('server__update_url', data => window.history.replaceState(null, null, data.id));

      // register receive events
      this.socket.on('recv', data => this.$root.$emit(`server__${data.type}`, data));

      // broadcast the pong event
      this.socket.on('pong', (ms) => {
        this.$store.commit('setPing', ms);
        this.$root.$emit('server__pong', ms);
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

    &.connecting {
      > *:not(.spinner) {
        opacity: 0.4;
      }
    }
  }

  .primary-header {
    position: relative;
    grid-column: 1 / 4;
    display: flex;
    align-items: center;
  }

  .spinner {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  }

  .spinner__status {
    margin-bottom: 0;
  }

  .spinner__error {
    color: red;
    margin-top: 10px;
    margin-bottom: 0;
  }
</style>
