<script>
  import Vue from 'vue';
  import player from '../player.vue';
  import queue from '../queue.vue';

  export default Vue.component('room-view', {
    functional: true,
    render: (h => {
      return [
        h(player),
        h(queue)
      ]
    })
  });
</script>