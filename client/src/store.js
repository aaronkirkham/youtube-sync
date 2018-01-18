import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

const store = new Vuex.Store({
  state: {
    im_the_host: false,
  },
  mutations: {
    IM_THE_HOST(state, value) {
      state.im_the_host = value;
      console.log('IM_THE_HOST', value);
    },
  },
});

export default store;