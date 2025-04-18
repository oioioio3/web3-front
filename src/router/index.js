import { createRouter, createWebHistory } from "vue-router";

// 直接导出所有模块配置的路由
const moduleFiles = import.meta.globEager("./modules/*.js");

// 通过 reduce 去搜集所有的模块的导出内容
const modulesRoutes = Object.keys(moduleFiles).reduce((routes, filepath) => {
  // 因为moduleFiles是一个函数，那么可以接受一个参数（string：文件的相对路径），调用其从而获取到对应路径下的模块的导出对象
  // 导出的对象中有一个属性：default，可以获取到默认导出的所有内容
  const value = moduleFiles[filepath].default;

  // 我们判断导出的是不是数组，是则进行拓展解构
  if (Array.isArray(value)) {
    routes.push(...value);
  } else {
    // 否则直接加到routes中
    routes.push(value);
  }
  return routes;
}, []);

const routes = [...modulesRoutes];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      require: "home",
    },
    ...routes,
  ],
  scrollBehavior() {
    // 始终滚动到顶部
    return { top: 0 };
  },
});

export default router;
