<template>
  <div id="debug">
    <table class="debug-info">
      <tr>
        <td>State:</td>
        <td>{{ isOnline ? 'Online' : 'Offline' }}</td>
      </tr>
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
  import Vue from 'vue';
  import store from '../store';

  export default Vue.component('debug-view', {
    data() {
      return {
        delta: 0,
      };
    },
    created() {
      this.$root.$on('debugPlayerDelta', delta => this.delta = delta);
    },
    methods: {
      playerDeltaColour() {
        if (this.delta > 0.4) return 'rgb(255, 0, 0)'
        else if (this.delta > 0.25) return 'rgb(255, 69, 0)';
        return 'inherit';
      },
    },
    computed: {
      isOnline: () => store.state.online,
      isHost: () => store.state.host,
      ping: () => store.state.ping,
    },  
  });
</script>

<style lang="scss" scoped>
  #debug {
    position: absolute;
    bottom: 25px;
    right: 25px;
    color: #aaaaaa;
    user-select: none;
    pointer-events: none;

    .debug-info {
      width: 100%;

      tr {
        td:first-child {
          width: 50%;
          padding-right: 10px;
        }

        td:last-child {
          text-align: right;
        }
      }
    }
  }
</style>
