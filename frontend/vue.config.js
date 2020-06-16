const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

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
    },
    // https://stackoverflow.com/a/55372086/1206421
    optimization: {
      splitChunks: {
        cacheGroups: {
          app: {
            chunks: 'all',
            name: 'all',
            test: /[\\/]src[\\/](.*)[\\/]/,
          },
          vendor: {
            chunks: 'all',
            name: 'vendor',
            test: /[\\/]node_modules[\\/](.*)[\\/]/,
          },
          styles: {
            name: 'styles',
            test: /\.s?css$/,
            chunks: 'all',
            minChunks: 1,
            reuseExistingChunk: true,
            enforce: true,
          }
        }
      }
    },
    // so it'd work with Webpack 4, which doesn't like [contenthash], which is there by default
    output: {
      filename: '[name].[hash].js',
      chunkFilename: '[name].[hash].js'
    }
  },
  chainWebpack: (config) => {
    if (process.env.NODE_ENV === 'test') {
      // too many workarounds, see
      // https://gist.githubusercontent.com/lsapan/3bfd0ffc0fb3d4a036fce84f6eea142e/raw/1e98fd0c5d27b445f083d6e2cb8e94b2a8ddaf8b/vue-tests-mocha-webpack-with-coverage.md
      const command = os.platform() === 'darwin'
        ? 'sed -i \'\' \'s/source: pathutils.relativeTo(start.source, origFile),/source: origFile,/\' node_modules/istanbul-lib-source-maps/lib/get-mapping.js'
        : 'sed -i \'s/source: pathutils.relativeTo(start.source, origFile),/source: origFile,/\' node_modules/istanbul-lib-source-maps/lib/get-mapping.js'
      execSync(command)

      config.devtool('cheap-module-eval-source-map')
      config.module.rule('js')
        .test(/\.js$/)
        .use('istanbul-instrumenter-loader')
        .loader('istanbul-instrumenter-loader')
        .before('babel-loader')
        .options({
          esModules: true,
        })
    }
  }
}

if (process.env.NODE_ENV === 'production') {
  const CompressionPlugin = require('compression-webpack-plugin');

  module.exports.configureWebpack.plugins = [
    new CompressionPlugin({
      algorithm: require('@gfx/zopfli').gzip,
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
        compressionOptions: { level: 11 }, // matches BROTLI_MAX_QUALITY
        minRatio: 0.99,
        test:  /\.(js|css|json|html|ico|svg)(\?.*)?$/i
    }));
  else // install optionalDependency iltorb
    module.exports.configureWebpack.plugins.push(
      new CompressionPlugin({
        filename: '[path].br[query]',
        algorithm: require('iltorb').compress,
        minRatio: 0.99,
        test:  /\.(js|css|json|html|ico|svg)(\?.*)?$/i
    }));
}
