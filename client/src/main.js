import Vue from 'vue';
import VueMeta from 'vue-meta';
import App from './app.vue';
import store from './store';

Vue.use(VueMeta);

// click-outside directive
/* eslint-disable no-param-reassign */
Vue.directive('click-outside', {
  bind(el, binding) {
    el.$clickOutsideHandler = (event) => {
      const { bubble } = binding.modifiers;
      if (bubble || (!el.contains(event.target) && el !== event.target)) {
        binding.value(event);
      }
    };

    el.addEventListener('click', el.$clickOutsideHandler);
    document.body.addEventListener('click', el.$clickOutsideHandler);
  },
  unbind(el) {
    document.body.removeEventListener('click', el.$clickOutsideHandler);
    el.$clickOutsideHandler = null;
  },
});

const vm = new Vue({
  el: '#app',
  store,
  render: h => h(App),
});

if (process.env.MODE === 'development') {
  window.vm = vm;
}
