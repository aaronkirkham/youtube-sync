import Vue from 'vue';
import './css/style.scss';
import App from './components/app.vue';

const vm = new Vue(App);
window.vm = vm;
