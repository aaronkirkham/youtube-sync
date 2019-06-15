import Vue from 'vue';
import VueMeta from 'vue-meta';
import App from './components/app.vue';

Vue.use(VueMeta);

const vm = new Vue(App);
window.vm = vm;
