import Vue from 'vue';
import VueMeta from 'vue-meta';
import App from './app.vue';
import store from './store';

Vue.use(VueMeta);

const vm = new Vue({
  el: '#app',
  store,
  render: h => h(App),
});

if (process.env.MODE === 'development') {
  window.vm = vm;
}
