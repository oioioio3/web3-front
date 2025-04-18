export default [{
    path: "/redirect/:path(.*)",
    component: () =>
        import ("@/views/home.vue"),
    children: [{
        path: "/",
        component: () =>
            import ("@/views/redirect/index.vue"),
    }, ],
}, ];