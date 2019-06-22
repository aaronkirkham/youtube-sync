<template>
  <div id="app" :class="{ 'connecting': !isOnline }">
    <header class="primary-header" role="banner">
      <h1 class="logo">
        <img :src="logo" width="50" height="50" class="logo-icon">
        YouTube Sync
      </h1>
      <SearchBox ref="search" />
    </header>
    <YoutubePlayer ref="player" />
    <PlayerQueue ref="queue" />
    <div v-if="!isOnline" class="loading">
      <img :src="logo" width="64" height="64">
      <h2 class="loading__status">{{ connectStatus }}</h2>
      <h3 v-if="connectError" class="loading__error">{{ connectError }}</h3>
    </div>
  </div>
</template>

<script>
  import { mapState } from 'vuex';
  import io from 'socket.io-client';
  import YoutubePlayer from './components/player.vue';
  import PlayerQueue from './components/queue.vue';
  import SearchBox from './components/search.vue';
  import Logo from './assets/logo.svg';

  export default {
    components: { YoutubePlayer, PlayerQueue, SearchBox },
    data() {
      return {
        logo: Logo,
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
      // figure out the root path
      // NOTE: if the client is in a subdirectory, we need to push to the correct relative path later.
      const { pathname } = document.location;
      this.rootPath = pathname.substr(0, pathname.lastIndexOf('/') + 1);

      this.socket = io(process.env.MODE === 'development' ? 'http://localhost:8888' : process.env.SOCKETURL);
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
  @import 'mixins.scss';

  * {
    box-sizing: border-box;
  }

  html, body {
    height: 100vh;
  }

  body {
    background-image: linear-gradient(0deg, #272e37 0%, #32383f 100%);
    font-family: 'PT Sans', sans-serif;
    font-weight: 700;
    color: #ffffff;
    padding: 50px;
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
    grid-gap: 25px;
    grid-template-columns: 83.975% auto;
    max-width: 1920px;
    margin: 0 auto;

    &.connecting {
      > *:not(.loading) {
        opacity: 0.4;
      }
    }
  }

  .primary-header {
    position: relative;
    grid-column: 1 / 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 7px 0 25px;

    .logo {
      display: flex;
      align-items: center;
      margin: 0;
    }

    .logo-icon {
      margin-right: 14px;
      pointer-events: none;
    }
  }

  .loading {
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

  .loading__status {
    margin-bottom: 0;
  }

  .loading__error {
    color: red;
    margin-top: 10px;
    margin-bottom: 0;
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes dash {
    0% {
      stroke-dasharray: 1, 150;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -124;
    }
  }

  .spinner {
    animation: rotate 2s linear infinite;

    & .path {
      stroke: #31373d;
      stroke-linecap: round;
      animation: dash 1.5s ease-in-out infinite;
    }
  }
</style>
