const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');

const config = require('../config');
const log = require('./logger');
const Bugsnag = require('./bugsnag');
const morgan = require('./morgan');
const middlewares = require('./middlewares');
const fetch = require('./fetch');
const courses = require('./courses');
const categories = require('./categories');
const pages = require('./pages');
const metrics = require('./metrics');
const endpointsMetrics = require('./endpoints_metrics');
const db = require('./sequelize');

const server = express();
server.use(bodyParser.json());
server.use(morgan);

const GeneralRouter = router({ mergeParams: true });
const CoursesRouter = router({ mergeParams: true });
const CategoriesRouter = router({ mergeParams: true });
const PagesRouter = router({ mergeParams: true });

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
CoursesRouter.get('/categories', categories.listAllCategories);
CoursesRouter.post('/categories', categories.createCategory);

CategoriesRouter.use(middlewares.authenticateUser, fetch.fetchCourse, fetch.fetchCategory);
CategoriesRouter.get('/', categories.getCategory);
CategoriesRouter.put('/', categories.updateCategory);
CategoriesRouter.delete('/', categories.deleteCategory);
CategoriesRouter.get('/pages', categories.listAllPages);
CategoriesRouter.post('/pages', categories.createPage);

PagesRouter.use(middlewares.authenticateUser, fetch.fetchCourse, fetch.fetchCategory, fetch.fetchPage);
PagesRouter.get('/', pages.getPage);
PagesRouter.put('/', pages.updatePage);
PagesRouter.delete('/', pages.deletePage);

server.use(endpointsMetrics.addEndpointMetrics);
server.use('/courses/:course_id', CoursesRouter);
server.use('/courses/:course_id/categories/:category_id', CategoriesRouter);
server.use('/courses/:course_id/categories/:category_id/pages/:page_id', PagesRouter);
server.use('/', GeneralRouter);
server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

let app;
async function startServer() {
    return new Promise((res, rej) => {
        log.info({ config }, 'Starting server with the following config');
        const localApp = server.listen(config.port, async () => {
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
