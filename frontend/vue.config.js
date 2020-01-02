const path = require('path');

module.exports = {
  lintOnSave: true,
  configureWebpack: {
    resolve: {
      alias: {
        // https://github.com/vuejs/vue/wiki/Vue-2.0-RC-Starter-Resources
        // vue: 'vue/dist/vue',
        package: path.resolve(__dirname, 'package.json'),
        src: path.resolve(__dirname, 'src'),
        assets: path.resolve(__dirname, 'src/assets'),
        components: path.resolve(__dirname, 'src/components'),
        views: path.resolve(__dirname, 'src/views'),
        // vue-addon
        'vuex-store': path.resolve(__dirname, 'src/store'),
      },
    }
  },
};
