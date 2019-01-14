
const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const GsuiteRouter = router({ mergeParams: true });
const wrapper = require('./gsuite-wrapper.js'); 
const log = require('./config/logger');

const config = require('./config/configFile.js');

//GsuiteRouter.use(middlewares.authenticateUser);

GsuiteRouter.post('/groups', wrapper.createGroup); //circle is created -> create a group
//GsuiteRouter.put('/groups', wrapper.modifyGroup); //circle is modified -> group is modified
//GsuiteRouter.put('/account/:username/group', wrapper.editMembershipToGroup); //user is into a circle -> user is added to a group
GsuiteRouter.delete('/groups/:name', wrapper.deleteGroup); //body is deleted -> group is deleted

GsuiteRouter.post('/accounts', wrapper.createAccount); //member is created -> create an account 

const server = express();
server.use(bodyParser.json());
server.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'), '-',
        tokens['response-time'](req, res), 'ms,',
        req.user ? ('user ' + req.user.user.name + ' with id ' + req.user.id) : 'unauthorized'
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

//server.use( (req, res, next) => errors.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl));
// error handler
// app.use(function(err, req, res, next) {
//     // set locals, only providing error message in development
//     res.locals.message = err.message;
//     res.locals.error = req.app.get('env') === 'development' ? err : {};
  
//     log.error(`(${serverInfo.host()}) : error handler says: `+err);
  
//     return res.status(err.status || 500).send({"error": err.message});
//   });
//server.use( (err, req, res, next) => {
//    // Handling invalid JSON
//    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
//        return errors.makeBadRequestError(res, 'Invalid JSON.');
//    }
//
//    // Handling validation errors
//    if (err.name && err.name === 'SequelizeValidationError') {
//        return errors.makeValidationError(res, err);
//    }
//
//    /* istanbul ignore next */
////    if (process.env.NODE_ENV !== 'test') {
////        bugsnag.notify(err);
////    }
//
//    /* istanbul ignore next */
//    log.error(err.stack);
//    /* istanbul ignore next */
//    return errors.makeInternalError(res, err);
//});

let app;
async function startServer() {
    return new Promise((res, rej) => {
        const localApp = server.listen(config.port, async () => {
            app = localApp;
            log.info('Up and running: %s listening on %s:%d', server.name, server.url, config.port);
            //await db.authenticate();
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
    //if (process.env.NODE_ENV !== 'test') await db.close();
    app = null;
}

module.exports = {
    app,
    server,
    stopServer,
    startServer
};
