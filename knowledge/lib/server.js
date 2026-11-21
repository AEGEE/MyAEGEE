const express = require('express');
const qs = require('qs');
const bodyParser = require('body-parser');

const config = require('../config');
const log = require('./logger');
const Bugsnag = require('./bugsnag');
const morgan = require('./morgan');
const middlewares = require('./middlewares');
const fetch = require('./fetch');
const courses = require('./courses');
const chapters = require('./chapters');
const pages = require('./pages');
const metrics = require('./metrics');
const endpointsMetrics = require('./endpoints_metrics');
const db = require('./sequelize');

const server = express();
// Express 5 defaults to the 'simple' query parser, and its 'extended' parser
// lowers qs's array limit to 20. Keep Express 4's behaviour: nested and bracketed
// parameters (filter[status]=..., type[]=...) with up to 1000 array items.
server.set('query parser', (str) => qs.parse(str, { allowPrototypes: true, arrayLimit: 1000 }));
server.use(bodyParser.json());
server.use(morgan);

const GeneralRouter = express.Router({ mergeParams: true });
const CoursesRouter = express.Router({ mergeParams: true });
const ChaptersRouter = express.Router({ mergeParams: true });
const PagesRouter = express.Router({ mergeParams: true });

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error({ err }, 'Unhandled rejection');

    if (process.env.NODE_ENV !== 'test') {
        Bugsnag.notify(err);
    }
});

GeneralRouter.get('/healthcheck', middlewares.healthcheck);
GeneralRouter.get('/metrics', metrics.getMetrics);
GeneralRouter.get('/metrics/requests', endpointsMetrics.getEndpointMetrics);
GeneralRouter.use(middlewares.authenticateUser);

GeneralRouter.get('/courses', courses.listAllCourses);
GeneralRouter.post('/courses', courses.createCourse);

CoursesRouter.use(middlewares.authenticateUser, fetch.fetchCourse);
CoursesRouter.get('/', courses.getCourse);
CoursesRouter.put('/', courses.updateCourse);
CoursesRouter.delete('/', courses.deleteCourse);
CoursesRouter.get('/chapters', chapters.listAllChapters);
CoursesRouter.post('/chapters', chapters.createChapter);

ChaptersRouter.use(middlewares.authenticateUser, fetch.fetchCourse, fetch.fetchChapter);
ChaptersRouter.get('/', chapters.getChapter);
ChaptersRouter.put('/', chapters.updateChapter);
ChaptersRouter.delete('/', chapters.deleteChapter);
ChaptersRouter.get('/pages', pages.listAllPages);
ChaptersRouter.post('/pages', pages.createPage);

PagesRouter.use(middlewares.authenticateUser, fetch.fetchCourse, fetch.fetchChapter, fetch.fetchPage);
PagesRouter.get('/', pages.getPage);
PagesRouter.put('/', pages.updatePage);
PagesRouter.delete('/', pages.deletePage);

server.use(endpointsMetrics.addEndpointMetrics);
server.use('/courses/:course_id', endpointsMetrics.recordMountPath('/courses/:course_id'), CoursesRouter);
server.use('/courses/:course_id/chapters/:chapter_id', endpointsMetrics.recordMountPath('/courses/:course_id/chapters/:chapter_id'), ChaptersRouter);
server.use('/courses/:course_id/chapters/:chapter_id/pages/:page_id', endpointsMetrics.recordMountPath('/courses/:course_id/chapters/:chapter_id/pages/:page_id'), PagesRouter);
server.use('/', endpointsMetrics.recordMountPath('/'), GeneralRouter);
server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

let app;
async function startServer() {
    return new Promise((res, rej) => {
        log.info({ config }, 'Starting server with the following config');
        const localApp = server.listen(config.port, async (err) => {
            // Express 5 also calls this on startup errors (EADDRINUSE etc.).
            if (err) return rej(err);
            app = localApp;
            log.info({ host: 'http://localhost:' + config.port }, 'Up and running, listening');
            await db.authenticate();
            return res();
        });
        /* istanbul ignore next */
        localApp.on('error', (err) => rej(new Error('Error starting server: ' + err.stack)));
    });
}

async function stopServer() {
    log.info('Stopping server...');
    app.close();
    /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'test') await db.close();
    app = null;
}

module.exports = {
    app,
    server,
    stopServer,
    startServer
};
