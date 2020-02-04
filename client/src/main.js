import Vue from 'vue';
import VueMeta from 'vue-meta';
import App from './app.vue';
import store from './store';

Vue.use(VueMeta);

// click-outside directive
Vue.directive('click-outside', {
  bind(el, binding) {
    if (typeof binding.value !== 'function') {
      console.error('v-click-outside handler must be a function!');
      return;
    }

    el.vueClickOutsideHandler = (event) => {
      const { bubble } = binding.modifiers;
      if (bubble || (!el.contains(event.target) && el !== event.target)) {
        binding.value(event);
      }
    };

    document.body.addEventListener('mousedown', el.vueClickOutsideHandler);
  },
  unbind(el) {
    document.body.removeEventListener('mousedown', el.vueClickOutsideHandler);
    el.vueClickOutsideHandler = null;
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
