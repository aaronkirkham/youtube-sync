<template>
  <aside class="queue">
    <h2 class="queue__title">Up Next</h2>
    <draggable ref="draggable" v-model="items" animation="100" class="queue__container" @change="change" @start="startDrag()" @end="stopDrag()">
      <transition-group name="draggable-list" tag="div">
        <div v-for="video in items" :key="video.id" class="queue-item-container">
          <div class="queue-item">
            <img :src="video.thumbnail" class="queue-item__thumbnail">
            <div class="queue-item__content">
              <h2 class="queue-item__title">{{ video.title }}</h2>
            </div>
          </div>
        </div>
      </transition-group>
    </draggable>
    <div v-if="items.length === 0" class="queue__empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="46.47" height="46.47">
        <path d="M46.222 41.889a2.998 2.998 0 0 1-1.562 3.943 2.997 2.997 0 0 1-3.944-1.562c-2.893-6.689-9.73-11.012-17.421-11.012-7.868 0-14.747 4.32-17.523 11.004a3.003 3.003 0 0 1-3.922 1.621 3.002 3.002 0 0 1-1.62-3.922c3.71-8.932 12.764-14.703 23.064-14.703 10.085.002 19.085 5.744 22.928 14.631zM2.445 6.559a6.202 6.202 0 1 1 12.399.001A6.202 6.202 0 0 1 2.445 6.56zm28.117 0a6.202 6.202 0 1 1 12.403.001 6.202 6.202 0 0 1-12.403-.001z" />
      </svg>
      <p>Nothing in the queue</p>
    </div>
  </aside>
</template>

<script>
  import { mapState } from 'vuex';
  import Draggable from 'vuedraggable';

  export default {
    name: 'PlayerQueue',
    components: { Draggable },
    data() {
      return {
        items: [],
      };
    },
    computed: mapState({
      isOnline: state => state.online,
    }),
    watch: {
      isOnline(state) {
        // clear the playlist if we go offline
        if (state === false) {
          this.items = [];
        }
      },
    },
    mounted() {
      this.$root.$on('server__queue--add', this.add);
      this.$root.$on('server__queue--remove', this.remove);
      this.$root.$on('server__queue--order', this.order);
      this.$root.$on('server__room--update', ({ queue }) => { this.items = queue; });
      this.$root.$on('queue-video', this.requestAdd);

      // @Debugging
      this.$root.$on('debugQueueVideos', this.debugQueueVideos);

      // @Debugging
      // this.items.push({
      //   id: 'sQUmD1jVCxM',
      //   title: 'Edlan - Go Back Home (Ft. MVE & Neil)',
      //   url: 'https://www.youtube.com/watch?v=sQUmD1jVCxM',
      //   thumbnail: 'https://i.ytimg.com/vi/sQUmD1jVCxM/mqdefault.jpg',
      // });

      // this.items.push({
      //   id: 'diliY4ERkLU',
      //   title: 'Hybrid Minds - Kismet ft. Riya',
      //   url: 'https://www.youtube.com/watch?v=diliY4ERkLU',
      //   thumbnail: 'https://i.ytimg.com/vi/diliY4ERkLU/mqdefault.jpg',
      // });

      // this.items.push({
      //   id: '-fCtvurGDD8',
      //   title: 'Birdy - Wings (Nu:Logic Remix)',
      //   url: 'https://www.youtube.com/watch?v=-fCtvurGDD8',
      //   thumbnail: 'https://i.ytimg.com/vi/-fCtvurGDD8/mqdefault.jpg',
      // });

      // this.items.push({
      //   id: 'oySqE3z99AE',
      //   title: 'Hybrid Minds - Inside (ft. Emily Jones)',
      //   url: 'https://www.youtube.com/watch?v=oySqE3z99AE',
      //   thumbnail: 'https://i.ytimg.com/vi/oySqE3z99AE/mqdefault.jpg',
      // });
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
          const { order } = data;
          return order.indexOf(a.id) > order.indexOf(b.id) ? 1 : -1;
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
        setTimeout(() => classes.remove('no-sort-animation'), 150);
      },

      /**
       * Event fired when queue order changed
       */
      change({ moved }) {
        // find the element which replaced the dragged one
        const elements = this.$refs.draggable.$el.querySelectorAll('.queue-item-container');
        const oldElement = elements[moved.oldIndex].firstChild;
        const newElement = elements[moved.newIndex].firstChild;

        /**
         * NOTE: When we drag an item and move it, the hover state will be applied to the
         * index of the item where we initially started dragging from. That's ugly, so this
         * little hack will forcefully chance the hover states using CSS.
         */
        const undoHackToFixBrowserBug = () => {
          oldElement.classList.remove('no-hover-animations');
          newElement.classList.remove('force-hover-animations');
          document.removeEventListener('mousemove', undoHackToFixBrowserBug, false);
        };

        oldElement.classList.add('no-hover-animations');
        newElement.classList.add('force-hover-animations');
        document.addEventListener('mousemove', undoHackToFixBrowserBug, false);

        // send updated order to the server!
        const order = this.items.map(item => item.id);
        this.$root.$emit('send', { type: 'queue--order', order });
      },

      /**
       * Tell the server we want to queue a video
       * NOTE: We expect the server to send us 'server__queue--add'
       */
      requestAdd(video) {
        if (typeof video === 'string') {
          // ensure the url is valid
          const segments = video.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
          if (segments === null || typeof segments[2] === 'undefined' || segments[2].length === 0) {
            console.error('invalid youtube url!');
            // @TODO: client errors
            return;
          }

          fetch(`https://noembed.com/embed?url=${video}`, { method: 'get' })
            .then(res => res.json())
            .then((data) => {
              const { title, url } = data;
              this.$root.$emit('send', {
                type: 'queue--add',
                id: segments[2],
                thumbnail: data.thumbnail_url.replace('hqdefault', 'mqdefault'),
                title,
                url,
              });
            })
            .catch(err => console.error(err));
        } else if (typeof video === 'object') {
          const { id, title, url } = video;
          this.$root.$emit('send', {
            type: 'queue--add',
            id,
            thumbnail: video.thumbnail.url,
            title,
            url,
          });
        }
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
          thumbnail: 'https://i.ytimg.com/vi/oySqE3z99AE/mqdefault.jpg',
        });

        this.$root.$emit('send', {
          type: 'queue--add',
          id: 'JSxCc2e3BEE',
          title: 'Hybrid Minds - Liquicity Winterfestival 2017',
          url: 'https://www.youtube.com/watch?v=JSxCc2e3BEE',
          thumbnail: 'https://i.ytimg.com/vi/JSxCc2e3BEE/mqdefault.jpg',
        });

        this.$root.$emit('send', {
          type: 'queue--add',
          id: '-fCtvurGDD8',
          title: 'Birdy - Wings (Nu:Logic Remix)',
          url: 'https://www.youtube.com/watch?v=-fCtvurGDD8',
          thumbnail: 'https://i.ytimg.com/vi/-fCtvurGDD8/mqdefault.jpg',
        });
      },
    },
  };
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

      > * { opacity: 0; }
    }
  }

  .queue {
    position: relative;
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
  }

  .queue__title {
    font-size: inherit;
    text-transform: uppercase;
    margin-top: 0;
    margin-bottom: 10px;
  }

  .queue__container {
    // position: absolute;
    // top: 0;
    // left: 0;
    // width: 100%;
    // height: 100%;
    // overflow-y: auto;

    // only use animations if the sort was done by the server (another user re-ordered the queue)
    &:not(.no-sort-animation) {
      .draggable-list-move {
        transition: transform 150ms linear;
      }
    }

    // show hover FX and remove button if we are not dragging the item
    &:not(.dragging):not(.sortable-chosen) {
      .queue-item:not(.no-hover-animations) {
        &.force-hover-animations,
        &:hover {
          .queue-item__thumbnail { opacity: 1; }
          .queue-item__content {
            > *, &::before { opacity: 1; }
          }
        }
      }
    }
  }

  .queue-item-container {
    user-select: none;

    &:not(:last-child) {
      margin-bottom: 10px;
    }
  }

  .queue-item {
    position: relative;
    line-height: 0;
    border-radius: 2px;
    @include transition(all);
    cursor: move;
    cursor: -webkit-grab;
    cursor: -moz-grab;
    cursor: grab;
  }

  .queue-item__thumbnail {
    max-width: 100%;
    height: auto;
    border-radius: inherit;
    opacity: 0.75;
    transition: opacity 150ms ease-in-out;
  }

  .queue-item__content {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 15px;
    display: flex;
    align-items: flex-end;
    line-height: 1.15;

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: linear-gradient(-180deg, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.60) 80%);
      opacity: 0;
      transition: opacity 150ms ease-in-out;
    }

    > * {
      position: relative;
      z-index: 1;
      opacity: 0;
      transition: opacity 150ms ease-in-out;
    }
  }

  .queue-item__title {
    font-size: 14px;
    text-shadow: 1px 2px 0 rgba(0, 0, 0, 0.35);
    margin: 0;
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
