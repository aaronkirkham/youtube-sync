import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

const store = new Vuex.Store({
  state: {
    is_online: false,
    im_the_host: false,
  },
  mutations: {
    TOGGLE_ONLINE(state, value) {
      state.is_online = value;
    },
    IM_THE_HOST(state, value) {
      state.im_the_host = value;
      console.log('IM_THE_HOST', value);
    },
  },
});

export default store;