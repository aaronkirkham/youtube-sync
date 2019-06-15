<template>
  <aside class="queue">
    <draggable v-model="items" animation="100" ref="draggable" class="queue__container" @start="startDrag()" @end="stopDrag()">
      <transition-group name="draggable-list" tag="div">
        <div v-for="video in items" :key="video.id" class="queue-item-container">
          <div class="queue-item">
            <div class="queue-item__thumbnail-container">
              <img :src="video.thumbnail" class="queue-item__thumbnail" />
            </div>
            <p class="queue-item__title">{{ video.title }}</p>
            <button class="button--no-native queue-item__remove" title="Remove video from queue" @click="requestRemove(video)">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </transition-group>
    </draggable>
    <div class="queue__empty" v-if="items.length === 0">
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
  import Draggable from 'vuedraggable';

  export default Vue.component('player-queue', {
    components: {
      Draggable
    },
    data() {
      return {
        items: [],
      };
    },
    mounted() {
      this.$root.$on('server__queue--add', this.add);
      this.$root.$on('server__queue--remove', this.remove);
      this.$root.$on('server__queue--order', this.order);
      this.$root.$on('server__room--update', ({ queue }) => this.items = queue);
      this.$root.$on('queue-video', this.requestAdd);

      // @Debugging
      this.$root.$on('debugQueueVideos', this.debugQueueVideos);
    },
    methods: {
      /**
       * Add a video to the local queue
       * NOTE: This does not tell the server
       */
      add(video) {
        this.items.push(video);
      },

      /**
       * Remove a video from the local queue
       * NOTE: This does not tell the server
       */
      remove(video) {
        this.items = this.items.filter(v => v.id !== video.id);
      },

      /**
       * Update local queue order from server
       * NOTE: This does not tell the server
       */
      order(data) {
        this.items.sort((a, b) => {
          return data.order.indexOf(a.id) > data.order.indexOf(b.id) ? 1 : -1;
        });
      },

      /**
       * User started dragging an item in the queue
       */
      startDrag() {
        const classes = this.$refs.draggable.$el.classList;
        classes.add('dragging', 'no-sort-animation');
      },

      /**
       * User stopped dragging an item in the queue
       */
      stopDrag() {
        const classes = this.$refs.draggable.$el.classList;
        classes.remove('dragging');

        const order = this.items.map(item => item.id);
        this.$root.$emit('send', { type: 'queue--order', order });

        setTimeout(() => classes.remove('no-sort-animation'), 150);
      },

      /**
       * Tell the server we want to queue a video
       * NOTE: We expect the server to send us 'server__queue--add'
       */
      requestAdd(url) {
        // ensure the url is valid
        const segments = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        if (segments === null || typeof segments[2] === 'undefined' || segments[2].length === 0) {
          console.error('invalid youtube url!');
          // TODO: client errors
          return;
        }

        fetch(`https://noembed.com/embed?url=${url}`, { method: 'get' })
          .then(res => res.json())
          .then((data) => {
            const { title, url, thumbnail_url } = data;
            this.$root.$emit('send', {
              type: 'queue--add',
              id: segments[2],
              thumbnail: thumbnail_url,
              title,
              url,
            });
          })
          .catch(err => console.error(err));
      },

      /**
       * Tell the server we want to remove a video from the queue
       * NOTE: We expect the server to send us 'server__queue--remove'
       */
      requestRemove(video) {
        this.$root.$emit('send', { type: 'queue--remove', id: video.id });
      },

      // @Debugging
      debugQueueVideos() {
        this.$root.$emit('send', {
          type: 'queue--add',
          id: 'oySqE3z99AE',
          title: 'Hybrid Minds - Inside (ft. Emily Jones)',
          url: 'https://www.youtube.com/watch?v=oySqE3z99AE',
          thumbnail: 'https://i.ytimg.com/vi/oySqE3z99AE/hqdefault.jpg',
        });

        this.$root.$emit('send', {
          type: 'queue--add',
          id: 'JSxCc2e3BEE',
          title: 'Hybrid Minds - Liquicity Winterfestival 2017',
          url: 'https://www.youtube.com/watch?v=JSxCc2e3BEE',
          thumbnail: 'https://i.ytimg.com/vi/JSxCc2e3BEE/hqdefault.jpg',
        });

        this.$root.$emit('send', {
          type: 'queue--add',
          id: '-fCtvurGDD8',
          title: 'Birdy - Wings (Nu:Logic Remix)',
          url: 'https://www.youtube.com/watch?v=-fCtvurGDD8',
          thumbnail: 'https://i.ytimg.com/vi/-fCtvurGDD8/hqdefault.jpg',
        });
      },
    },
    computed: {
      isOnline: () => store.state.online,
    },
    watch: {
      isOnline(state) {
        // clear the playlist if we go offline
        if (state === false) {
          this.items = [];
        }
      },
    },
  });
</script>

<style lang="scss" scoped>
  @import '../mixins.scss';

  .sortable-chosen,
  .dragging {
    * {
      cursor: -webkit-grabbing !important;
      cursor: -moz-grabbing !important;
      cursor: grabbing !important;
    }
  }

  .sortable-ghost {
    .queue-item {
      background-color: rgba(0, 0, 0, 0.2);

      > * {
        display: none;
      }
    }
  }

  .queue {
    position: relative;
    grid-column: 3;
  }

  .queue__container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow-y: auto;

    // only use animations if the sort was done by the server (another user re-ordered the queue)
    &:not(.no-sort-animation) {
      .draggable-list-move {
        transition: transform 150ms linear;
      }
    }

    // show hover FX and remove button if we are not dragging the item
    &:not(.dragging):not(.sortable-chosen) {
      .queue-item {
        &:hover {
          box-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.20);

          .queue-item__remove {
            opacity: 1;
            visibility: visible;
          }
        }
      }
    }
  }

  .queue-item-container {
    padding: 5px 0;
    user-select: none;
  }

  .queue-item {
    position: relative;
    font-size: 15px;
    padding: 10px;
    height: 100px;
    background-color: rgba(255, 255, 255, 0.10);
    @include transition(all);
    cursor: move;
    cursor: -webkit-grab;
    cursor: -moz-grab;
    cursor: grab;

    .queue-item__thumbnail-container {
      float: left;
      width: 153px;
      height: 80px;
      overflow: hidden;
      padding-right: 10px;
    }

    .queue-item__thumbnail {
      width: inherit;
      height: inherit;
      object-fit: cover;
    }

    // .queue-item__actions {
    //   opacity: 0;
    //   visibility: hidden;
    //   @include transition(all);
    // }

    .queue-item__remove {
      position: absolute;
      top: 10px;
      right: 10px;
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      @include transition(all);

      &:hover {
        svg {
          stroke: #ffffff;
        }
      }

      svg {
        stroke: rgba(255, 255, 255, 0.35);
        @include transition(stroke);
      }
    }
  }

  .queue__empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    font-size: 24px;
    color: rgba(255, 255, 255, 0.5);

    svg {
      fill: rgba(255, 255, 255, 0.5);
      margin-bottom: 25px;
    }
  }
</style>
