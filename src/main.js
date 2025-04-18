import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import App from "./App.vue";
import router from "./router";

// bootstrap
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
//ElementPlus
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import 'vant/lib/index.css';
// 全局组件
// 全局懒加载指令
import { lazyPlugin } from "@/directives";
const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);


// 全局指令注册
app.use(pinia);
app.use(lazyPlugin);
// app.use(socketIo);
app.use(router);
//ElementPlus
app.use(ElementPlus)
app.mount("#app").$nextTick(() => {

});