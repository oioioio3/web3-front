import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

import Components from "unplugin-vue-components/vite";
import { VantResolver } from "@vant/auto-import-resolver";
// 导入对应包
// import ElementPlus from "unplugin-element-plus/vite";
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        // ...
        Components({
            resolvers: [VantResolver()],
        }),
    ],

    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src",
                import.meta.url)),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                // 自动导入定制化样式文件进行样式覆盖
                // style style 不要写错
                additionalData: `@use "@/styles/common.scss" as *;`,
            },
        },
    },
    server: {
        host: true,
        proxy: {
            "/api": {
                target: "http://localhost:8800",
                changeOrigin: true, //支持跨域
                rewrite: (path) => path.replace(/^\/api/, ""), //重写路径,替换/api
            },
        },
    },
    build: {
        outDir: "dist", // 指定输出目录
        cssCodeSplit: true, // 启用 CSS 代码拆分
        rollupOptions: {
            output: {
                entryFileNames: "js/[name]-[hash].js", // 自定义输出的 JavaScript 文件夹和文件名
                assetFileNames: "css/[name]-[hash][extname]", // 自定义输出的 CSS 文件夹和文件名
                chunkFileNames: "js/[name]-[hash].js", // 自定义输出的代码块文件夹和文件名
            },
        },
    }, 
});