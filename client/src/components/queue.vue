<template>
  <aside class="queue">
    <draggable v-model="items" v-bind:options="draggable_options" ref="draggable" class="queue__container" @start="startDrag()" @end="stopDrag()">
      <transition-group name="draggable-list" tag="div">
        <div v-for="video in items" v-bind:key="video.id" class="queue-item-container">
          <div class="queue-item">
            <div class="queue-item__thumbnail-container">
              <img v-bind:src="video.thumbnail" class="queue-item__thumbnail" />
            </div>
            <p class="queue-item__title">{{ video.title }}</p>
            <button class="button--no-native queue-item__remove" title="Remove video from queue" @click="remove(video)">
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
  import draggable from 'vuedraggable';

  export default Vue.component('player-queue', {
    components: { draggable },
    data: () => ({
      items: [],
      draggable_options: {
        animation: 100,
      },
    }),
    created() {
      // this.items.push({ id: '1', title: 'This is a video title' });
      // this.items.push({ id: '2', title: 'This is a video title' });
      // this.items.push({ id: '3', title: 'This is a video title' });
    },
    mounted() {
      this.$root.$on('server__queue--add', data => this.items.push(data));
      this.$root.$on('server__queue--remove', data => this.items = this.items.filter(v => v.id !== data.id));
      this.$root.$on('server__queue--order', data => {
        this.items.sort((a, b) => {
          return data.order.indexOf(a.id) > data.order.indexOf(b.id) ? 1 : -1;
        });
      });
      this.$root.$on('server__room--update', data => this.items = data.queue);
    },
    methods: {
      remove(video) {
        this.$root.$emit('send', { type: 'queue--remove', id: video.id });
      },
      // queueSort(end) {
      //   const draggable_container = document.getElementById('player-queue-draggable');
      //   draggable_container.classList.toggle('dragging', !end);

      //   if (end) {
      //     const order = this.items.map(item => item.id);
      //     this.$root.$emit('send', { type: 'queue--order', order });
      //     setTimeout(() => draggable_container.classList.remove('no-sort-animation'), 150);
      //   } else {
      //     draggable_container.classList.add('no-sort-animation');
      //   }
      // },
      startDrag() {
        const classes = this.$refs.draggable.$el.classList;
        classes.add('dragging', 'no-sort-animation');
      },
      stopDrag() {
        const classes = this.$refs.draggable.$el.classList;
        classes.remove('dragging');

        const order = this.items.map(item => item.id);
        this.$root.$emit('send', { type: 'queue--order', order });

        setTimeout(() => classes.remove('no-sort-animation'), 150);
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
