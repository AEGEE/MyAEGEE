const path = require('path')

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
        'vuex-store': path.resolve(__dirname, 'src/store')
      }
    }
  }
}

if (process.env.NODE_ENV === 'production') {
  const CompressionPlugin = require('compression-webpack-plugin');

  module.exports.configureWebpack.plugins = [
    new CompressionPlugin({
      algorithm: require("@gfx/zopfli").gzip,
      compressionOptions: {
        numiterations: 15
      },
      minRatio: 0.99,
      test:  /\.(js|css|json|html|ico|svg)(\?.*)?$/i
    })
  ];
  if (require('zlib').brotliCompress) // Since Node 11.7
    module.exports.configureWebpack.plugins.push(
      new CompressionPlugin({
        filename: '[path].br[query]',
        algorithm: 'brotliCompress',
        compressionOptions: { level:11 }, //matches BROTLI_MAX_QUALITY
        minRatio: 0.99,
        test:  /\.(js|css|json|html|ico|svg)(\?.*)?$/i
    }));
  else //install optionalDependency iltorb
    module.exports.configureWebpack.plugins.push(
      new CompressionPlugin({
        filename: '[path].br[query]',
        algorithm: require('iltorb').compress,
        minRatio: 0.99,
        test:  /\.(js|css|json|html|ico|svg)(\?.*)?$/i
    }));
}
