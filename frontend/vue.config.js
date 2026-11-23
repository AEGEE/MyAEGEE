const path = require('path');
const webpack = require('webpack');

module.exports = {
  lintOnSave: true,
  transpileDependencies: ['axios'],
  css: {
    loaderOptions: {
      sass: {
        sassOptions: {
          // quietDeps hides deprecation warnings from Bulma/Buefy's own Sass;
          // silenceDeprecations hides those for our @import of Bulma until it's upgraded.
          quietDeps: true,
          silenceDeprecations: ['import'],
        },
      },
    },
  },
  // Only used by `vue-cli-service serve`, i.e. the frontend container when the
  // stack runs without Traefik (MYAEGEE_GATEWAY=devserver).
  devServer: {
    proxy: require('./docker/devserver/proxy'),
    // Answer /healthcheck like the nginx frontend does (the Status page uses it).
    setupMiddlewares: (middlewares, devServer) => {
      devServer.app.get('/healthcheck', (req, res) => res.sendFile(path.resolve(__dirname, 'public/status.json')));
      return middlewares;
    },
    client: {
      // The browser reaches the dev server through a published port, so the
      // hot reload socket must use whatever host and port the page came from.
      webSocketURL: 'auto://0.0.0.0:0/ws',
      overlay: { errors: true, warnings: false },
    },
  },
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
    },
  },
};

// FRONTEND_COVERAGE=1 gives the build that the end-to-end tests measure coverage on: the code of
// src/ instrumented by build/coverage-loader.js, not minified and not compressed. Nothing of it
// is loaded without the variable (istanbul-lib-instrument is a devDependency).
const coverage = process.env.FRONTEND_COVERAGE === '1';

if (coverage) {
  module.exports.configureWebpack.optimization = { minimize: false };
  module.exports.configureWebpack.devtool = 'source-map';
  module.exports.chainWebpack = (config) => {
    config.module.rule('coverage').test(/\.js$/).include.add(path.resolve(__dirname, 'src')).end()
      .enforce('post').use('coverage').loader(path.resolve(__dirname, 'build/coverage-loader.js'));
  };
}

if (process.env.NODE_ENV === 'production') {
  module.exports.configureWebpack.plugins = [
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
  ];
}

if (process.env.NODE_ENV === 'production' && !coverage) {
  const CompressionPlugin = require('compression-webpack-plugin');

  module.exports.configureWebpack.plugins.push(
    new CompressionPlugin({
      algorithm: require('@gfx/zopfli').gzip,
      compressionOptions: {
        numiterations: 15,
      },
      minRatio: 0.99,
      test: /\.(js|css|json|html|ico|svg)(\?.*)?$/i,
    }),
    new CompressionPlugin({
      filename: '[path][base].br[query]',
      algorithm: 'brotliCompress',
      compressionOptions: { level: 11 }, // matches BROTLI_MAX_QUALITY
      minRatio: 0.99,
      test: /\.(js|css|json|html|ico|svg)(\?.*)?$/i,
    })
  );
}
