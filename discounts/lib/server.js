const express = require('express');
const qs = require('qs');
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
// Express 5 defaults to the 'simple' query parser, and its 'extended' parser
// lowers qs's array limit to 20. Keep Express 4's behaviour: nested and bracketed
// parameters (filter[status]=..., type[]=...) with up to 1000 array items.
server.set('query parser', (str) => qs.parse(str, { allowPrototypes: true, arrayLimit: 1000 }));
server.use(bodyParser.json());
server.use(morgan);

const GeneralRouter = express.Router({ mergeParams: true });

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
server.use('/', endpointsMetrics.recordMountPath('/'), GeneralRouter);
server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

let app;
async function startServer() {
    return new Promise((res, rej) => {
        // Host, port and environment only: the configuration holds passwords and keys.
        log.info({ host: config.host, port: config.port, env: process.env.NODE_ENV }, 'Starting server');
        const localApp = server.listen(config.port, async (err) => {
            // Express 5 also calls this on startup errors (EADDRINUSE etc.).
            if (err) return rej(err);
            app = localApp;
            log.info({ host: 'http://localhost:' + config.port }, 'Up and running, listening');
            await db.authenticate();
            return res();
        });
        localApp.on('error', (err) => rej(new Error('Error starting server: ' + err.stack)));
    });
}

async function stopServer() {
    log.info('Stopping server...');
    app.close();
    if (process.env.NODE_ENV !== 'test') await db.close();
    app = null;
}

module.exports = {
    app,
    server,
    stopServer,
    startServer
};
