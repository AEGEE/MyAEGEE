const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');

const config = require('../config');
const log = require('./logger');
const Bugsnag = require('./bugsnag');
const morgan = require('./morgan');
const middlewares = require('./middlewares');
const integrations = require('./integrations');
const categories = require('./categories');
const metrics = require('./metrics');
const endpointsMetrics = require('./endpoints_metrics');
const db = require('./sequelize');

const server = express();
server.use(bodyParser.json());
server.use(morgan);

const GeneralRouter = router({ mergeParams: true });

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

// integrations and codes
GeneralRouter.get('/integrations', integrations.listAllIntegrations);
GeneralRouter.post('/integrations', integrations.createIntegration);
GeneralRouter.post('/integrations/:integration_id/codes', integrations.findIntegration, integrations.addCodesToIntegration);
GeneralRouter.post('/integrations/:integration_id/claim', integrations.findIntegration, integrations.claimCode);
GeneralRouter.get('/integrations/:integration_id', integrations.findIntegration, integrations.getIntegration);
GeneralRouter.put('/integrations/:integration_id', integrations.findIntegration, integrations.updateIntegration);
GeneralRouter.delete('/integrations/:integration_id', integrations.findIntegration, integrations.deleteIntegration);

GeneralRouter.get('/codes/mine', integrations.getMyCodes);

// categories and discounts (for listing to members)
GeneralRouter.get('/categories', categories.listAllCategories);
GeneralRouter.post('/categories', categories.createCategory);
GeneralRouter.get('/categories/:category_id', categories.findCategory, categories.getCategory);
GeneralRouter.put('/categories/:category_id', categories.findCategory, categories.updateCategory);
GeneralRouter.delete('/categories/:category_id', categories.findCategory, categories.deleteCategory);

server.use(endpointsMetrics.addEndpointMetrics);
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
