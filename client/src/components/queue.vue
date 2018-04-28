<template>
  <aside class="player__queue">
    <draggable v-model="items" v-bind:options="draggable_options" id="player-queue-draggable" class="player__queue-container" @start="queueSort(false)" @end="queueSort(true)">
      <div v-for="video in items" v-bind:key="video.id" class="player__queue-item-container">
        <div class="player__queue-item">
          <div class="player__queue-item-thumbnail-container">
            <img v-bind:src="video.thumbnail" class="player__queue-item-thumbnail" />
          </div>
          <p class="player__queue-item-title">{{ video.title }}</p>
          <button class="button--no-native player__queue-item-remove" title="Remove video from queue" @click="removeFromQueue(video)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </draggable>
    <div class="player__queue-no-items" v-if="items.length === 0">
      <svg xmlns="http://www.w3.org/2000/svg" width="46.47" height="46.47">
        <path d="M46.222 41.889a2.998 2.998 0 0 1-1.562 3.943 2.997 2.997 0 0 1-3.944-1.562c-2.893-6.689-9.73-11.012-17.421-11.012-7.868 0-14.747 4.32-17.523 11.004a3.003 3.003 0 0 1-3.922 1.621 3.002 3.002 0 0 1-1.62-3.922c3.71-8.932 12.764-14.703 23.064-14.703 10.085.002 19.085 5.744 22.928 14.631zM2.445 6.559a6.202 6.202 0 1 1 12.399.001A6.202 6.202 0 0 1 2.445 6.56zm28.117 0a6.202 6.202 0 1 1 12.403.001 6.202 6.202 0 0 1-12.403-.001z" />
      </svg>
      <p>Nothing in the queue</p>
    </div>
  </aside>
</template>

<script>
  import Vue from 'vue';
  import store from '../store';
  import draggable from 'vuedraggable';

  export default Vue.component('player-queue', {
    components: { draggable },
    data: () => ({
      items: [],
      draggable_options: {
        animation: 100,
      },
    }),
    mounted() {
      this.$root.$on('server__queue--add', data => this.items.push(data));
      this.$root.$on('server__queue--remove', data => this.items = this.items.filter(v => v.id !== data.id));
      this.$root.$on('server__room--update', data => this.items = data.queue);
    },
    methods: {
      removeFromQueue(video) {
        console.log(`removing "${video.title}" (${video.id}) from queue...`);
        this.$root.$emit('send', { type: 'queue--remove', id: video.id });
      },
      queueSort(end) {
        document.getElementById('player-queue-draggable').classList.toggle('dragging', !end);

        if (end) {
          console.log(`sending updated queue order...`);
          console.log(this.items);
        }
      },
    },
    computed: {
      is_online: () => store.state.is_online,
    },
  });
</script>