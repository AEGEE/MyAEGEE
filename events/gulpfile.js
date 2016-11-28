var gulp        = require('gulp');
var webserver   = require('gulp-webserver');
var nodemon     = require('gulp-nodemon');
var proxy       = require('http-proxy-middleware');
var config      = require('./lib/config/config.json');
var spawn       = require('child_process').spawn;

gulp.task('frontend', function () {
  // Redirect api calls to the backend server
  var apiProxy = proxy('/api', {
        target: 'http://localhost:' + config.port + '/',
        pathRewrite: { '^/api': '/' },
      });

  // Redirect static requests to the static server to avoid reloading of things
  //var staticProxy = proxy('/static', {
  //	target: 'http://localhost:8081/'
  //});

  gulp.src('./frontend')
.pipe(webserver({
    host: '0.0.0.0',
    path: '/frontend',
    livereload: false,
    port: 8083,
    directoryListing: false,
    middleware: [apiProxy],
  }));
});

gulp.task('backend', function () {

    // Start the Node server to provide the API
    // Supervisor manages to reload stuff
    //supervisor("lib/server.js");
    // Nodemon takes less than 20% cpu usage
    var bunyan;
    nodemon({
        script: 'lib/server.js',
        ext: 'js json',
        watch: ['lib', 'lib/config'],
        stdout: false,
      })

    // Pipe nodemon output to bunyan
    .on('readable', function () {

        // free memory
        bunyan && bunyan.kill();

        bunyan = spawn('./node_modules/bunyan/bin/bunyan', [
            '--output', 'short',
            '--color',
        ]);

        bunyan.stdout.pipe(process.stdout);
        bunyan.stderr.pipe(process.stderr);

        this.stdout.pipe(bunyan.stdin);
        this.stderr.pipe(bunyan.stdin);
      });
  });

gulp.task('default', ['frontend', 'backend']);
