const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const GsuiteRouter = router({ mergeParams: true });
const swaggerJSDoc = require('swagger-jsdoc');
const wrapper = require('./gsuite-wrapper');
const log = require('./util/logger');
const serverInfo = require('./util/info');

const middlewares = require('./middlewares');

const config = require('./config/configFile');
const redis = require('./redis');

GsuiteRouter.get('/healthcheck', middlewares.healthcheck);

GsuiteRouter.post('/group', wrapper.createGroup); // circle is created -> create a group
// GsuiteRouter.put('/group', wrapper.modifyGroup); //circle is modified -> group is modified
GsuiteRouter.put('/account/:userPK/group', wrapper.editMembershipToGroup); // user is into a circle -> user is added to a group
GsuiteRouter.delete('/group/:bodyPK', wrapper.deleteGroup); // body is deleted -> group is deleted //FIXME: archived*

GsuiteRouter.get('/account', wrapper.listAccounts); // retrieve list of accounts
GsuiteRouter.post('/account', wrapper.createAccount); // member is created -> create an account
GsuiteRouter.put('/account/:userPK/alias', wrapper.updateAlias); // user may need an alias (netcom-xxx@aegee.eu)
GsuiteRouter.get('/account/:userPK/alias', wrapper.getAliasFromRedis); // user can read their alias (netcom-xxx@aegee.eu)
GsuiteRouter.put('/account/:userPK', wrapper.editAccount); // change pic, password, suspend (not delete)

GsuiteRouter.post('/calendar', wrapper.createCalEvent); // event is accepted by EQAC -> put in calendar of events

const options = {}; // (1/3) stupid gimmick because fuck the library lol
options.definition = require('./util/swaggerDef'); // (2/3) cli options are slightly different
options.apis = require('./util/swaggerDef').apis;
// (3/3) so i have to make this gimmick
const swaggerSpec = swaggerJSDoc(options); // Initialize swagger-jsdoc -> returns validated swagger spec in json format

GsuiteRouter.get('/api-docs.json', (req, res) => { // mini-route to retrieve the docs
    log.info('request coming from ' + req.ip + ' to ' + req.hostname);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(swaggerSpec);
});

const server = express();
server.use(bodyParser.json());
server.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'), '-',
        tokens['response-time'](req, res), 'ms,',
        req.user ? ('user ' + req.user.user.name + ' with id ' + req.user.id) : 'unauthorized',
    ].join(' ');
}, { stream: log.stream }));

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error('Unhandled rejection: %s', err.stack);

//    if (process.env.NODE_ENV !== 'test') {
//        bugsnag.notify(err);
//    }
});

server.use('/', GsuiteRouter);

server.use(middlewares.notFound);
server.use(middlewares.errorHandler);
// error handler
// app.use(function(err, req, res, next) {
//     // set locals, only providing error message in development
//     res.locals.message = err.message;
//     res.locals.error = req.app.get('env') === 'development' ? err : {};

//     log.error(`(${serverInfo.host}) : error handler says: `+err);

//     return res.status(err.status || 500).send({"error": err.message});
//   });

let app;
async function startServer() {
    return new Promise((res, rej) => {
        const localApp = server.listen(config.port, async () => {
            app = localApp;
            log.info('Up and running: %s listening on %s:%d', server.name, config.url, config.port);
            log.info('Version %s of %s in %s mode, deployed on %s', serverInfo.version, serverInfo.name, serverInfo.env, serverInfo.host);
            const result = await redis.start();
            return res(result);
        });
        /* istanbul ignore next */
        localApp.on('error', (err) => rej(new Error('Error starting server: ' + err.stack)));
    });
}

async function stopServer() {
    log.info('Stopping server...');
    app.close();
    /* istanbul ignore next */
    // if (process.env.NODE_ENV !== 'test') await db.close();
    const result = await redis.stop();
    app = null;
    log.info('Server stopped');
    return result;
}

module.exports = {
    app,
    server,
    stopServer,
    startServer,
};
