const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');

const config = require('../config');
const log = require('./logger');
const bugsnag = require('./bugsnag');
const morgan = require('./morgan');
const middlewares = require('./middlewares');
const integrations = require('./integrations');
const db = require('./sequelize');

const server = express();
server.use(bodyParser.json());
server.use(morgan);

const GeneralRouter = router({ mergeParams: true });

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error('Unhandled rejection: %s', err.stack);

    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }
});

GeneralRouter.use(middlewares.authenticateUser);
GeneralRouter.get('/integrations', integrations.listAllIntegrations);
GeneralRouter.post('/integrations', integrations.createIntegration);
GeneralRouter.post('/integrations/:integration_id/codes', integrations.findIntegration, integrations.addCodesToIntegration);
GeneralRouter.post('/integrations/:integration_id/claim', integrations.findIntegration, integrations.claimCode);
GeneralRouter.put('/integrations/:integration_id', integrations.findIntegration, integrations.updateIntegration);
GeneralRouter.delete('/integrations/:integration_id', integrations.findIntegration, integrations.deleteIntegration);

GeneralRouter.post('/codes/mine', integrations.getMyCodes);


server.use('/', GeneralRouter);
server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

let app;
async function startServer() {
    return new Promise((res, rej) => {
        const localApp = server.listen(config.port, async () => {
            app = localApp;
            log.info('Up and running, listening on http://localhost:%d', config.port);
            await db.authenticate();
            return res();
        });
        /* istanbul ignore next */
        localApp.on('error', err => rej(new Error('Error starting server: ' + err.stack)));
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
