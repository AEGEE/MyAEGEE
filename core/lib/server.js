const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');
const boolParser = require('express-query-boolean');

const morgan = require('./morgan');
const helpers = require('./helpers');
const db = require('./sequelize');
const log = require('./logger');
const config = require('../config');
const bugsnag = require('./bugsnag');
const cron = require('./cron');

const middlewares = require('../middlewares/generic');
const campaigns = require('../middlewares/campaigns');

const GeneralRouter = router({ mergeParams: true });

const server = express();
server.use(bodyParser.json());
server.use(morgan);
server.use(boolParser());

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error('Unhandled rejection: ', err);

    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }
});

GeneralRouter.get('/healthcheck', middlewares.healthcheck);
GeneralRouter.post('/signup/:campaign_id', campaigns.registerUser);

server.use('/', GeneralRouter);

server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

let app;
async function startServer() {
    return new Promise((res, rej) => {
        log.info('Starting server with the following config: %o', helpers.filterFields(config, config.filter_fields));
        const localApp = server.listen(config.port, async () => {
            app = localApp;
            log.info('Up and running, listening on http://localhost:%d', config.port);
            await db.authenticate();
            log.info('DB connection is successful.');
            await cron.registerAllTasks();
            log.info('All cron tasks are registered.');
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
