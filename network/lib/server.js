const express = require('express');
const qs = require('qs');
const bodyParser = require('body-parser');

const config = require('../config');
const log = require('./logger');
const Bugsnag = require('./bugsnag');
const morgan = require('./morgan');
const middlewares = require('./middlewares');
const boards = require('./boards');
const antennaCriteria = require('./antenna_criteria');
const netcom = require('./netcom');
const mailComponent = require('./mail_component');
const metrics = require('./metrics');
const endpointsMetrics = require('./endpoints_metrics');
const db = require('./sequelize');
const { job } = require('./cron');

const server = express();
// Express 5 defaults to the 'simple' query parser, and its 'extended' parser
// lowers qs's array limit to 20. Keep Express 4's behaviour: nested and bracketed
// parameters (filter[status]=..., type[]=...) with up to 1000 array items.
server.set('query parser', (str) => qs.parse(str, { allowPrototypes: true, arrayLimit: 1000 }));
server.use(bodyParser.json());
server.use(morgan);

const GeneralRouter = express.Router({ mergeParams: true });

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
GeneralRouter.get('/boards/recents', boards.listMostRecentBoardsElected);
GeneralRouter.get('/bodies/:body_id/boards', boards.listAllBoardsBody);
GeneralRouter.post('/bodies/:body_id/boards', boards.createBoard);
GeneralRouter.get('/bodies/:body_id/boards/current', boards.listCurrentBoardBody);
GeneralRouter.get('/bodies/:body_id/boards/:board_id', boards.findBoard, boards.getBoard);
GeneralRouter.put('/bodies/:body_id/boards/:board_id', boards.findBoard, boards.updateBoard);
GeneralRouter.delete('/bodies/:body_id/boards/:board_id', boards.findBoard, boards.deleteBoard);

GeneralRouter.get('/antennaCriteria/:agora_id', antennaCriteria.listCriteria);
GeneralRouter.put('/antennaCriteria', antennaCriteria.setCriterion);
GeneralRouter.post('/antennaCriteria/sendFulfilmentMail', antennaCriteria.sendFulfilmentMail);

GeneralRouter.get('/netcom', netcom.listNetcomAssignment);
GeneralRouter.put('/netcom', netcom.setNetcomAssignment);
GeneralRouter.delete('/netcom/:body_id', netcom.removeNetcomAssignment);

GeneralRouter.get('/mailComponent/:agora_id', mailComponent.listMailComponents);
GeneralRouter.put('/mailComponent', mailComponent.setMailComponent);

server.use(endpointsMetrics.addEndpointMetrics);
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
            job.start();
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
