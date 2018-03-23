import Vue from 'vue';
import VueRouter from 'vue-router';

import Index from './components/routes/index.vue';
import Room from './components/routes/room.vue';

Vue.use(VueRouter);

const router = new VueRouter({
  mode: 'history',
  routes: [
    { path: '/', name: 'index', component: Room },
    { path: '/:roomid', name: 'room', component: Room },
  ]
});

export default router;