const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');

const config = require('../config');
const log = require('./logger');
const Bugsnag = require('./bugsnag');
const morgan = require('./morgan');
const middlewares = require('./middlewares');
const boards = require('./boards');
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

GeneralRouter.get('/boards', boards.listAllBoards);
GeneralRouter.get('/bodies/:body_id', boards.listAllBoardsBody);
GeneralRouter.post('/bodies/:body_id/boards', boards.createBoard);
GeneralRouter.get('/bodies/:body_id/boards/current', boards.listCurrentBoardBody);
GeneralRouter.get('/bodies/:body_id/boards/:board_id', boards.findBoard, boards.getBoard);
GeneralRouter.put('/bodies/:body_id/boards/:board_id', boards.findBoard, boards.updateBoard);
GeneralRouter.delete('/bodies/:body_id/boards/:board_id', boards.findBoard, boards.deleteBoard);

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
