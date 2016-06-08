var gulp = require('gulp');
var webserver = require('gulp-webserver');
var nodemon = require('gulp-nodemon');
var proxy = require('http-proxy-middleware');
var config = require('./lib/config/config.json');


gulp.task('frontend', function () {
	var apiProxy = proxy('/api', {
        target: 'http://localhost:' + config.port + '/',
		pathRewrite: {'^/api': '/'}
    });
	
    gulp.src('frontend')
		.pipe(webserver({
			host: '0.0.0.0',
			livereload: true,
			port: 8083,
			middleware: [apiProxy]
		}));
});

gulp.task('backend', function () {

    // Start the Node server to provide the API
    nodemon({ cwd: './lib', script: 'server.js', ext: 'js' })
        .on('restart', function () {
            console.log('Node server restarted!')
        });
});
gulp.task('default', ['frontend', 'backend']);
