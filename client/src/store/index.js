import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

const getters = {
  online: state => state.online,
  host: state => state.host,
  ping: state => state.ping,
};

const actions = {
};

const mutations = {
  setOnline(state, online) {
    state.online = online;
  },
  setHost(state, host) {
    state.host = host;
  },
  setPing(state, ping) {
    state.ping = ping;
  },
};

const state = {
  online: false,
  host: false,
  ping: 0,
};

export default new Vuex.Store({
  struct: true,
  state,
  getters,
  actions,
  mutations,
});
