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
const fetch = require('../middlewares/fetch');
const myPermissions = require('../middlewares/my-permissions');
const campaigns = require('../middlewares/campaigns');
const register = require('../middlewares/register');
const login = require('../middlewares/login');
const members = require('../middlewares/members');
const bodies = require('../middlewares/bodies');
const circles = require('../middlewares/circles');
const permissions = require('../middlewares/permissions');
const memberships = require('../middlewares/memberships');
const joinRequests = require('../middlewares/join-requests');
const bodyCampaigns = require('../middlewares/body-campaigns');
const payments = require('../middlewares/payments');

const GeneralRouter = router({ mergeParams: true });
const MemberRouter = router({ mergeParams: true });
const BodiesRouter = router({ mergeParams: true });
const MembershipsRouter = router({ mergeParams: true });
const JoinRequestsRouter = router({ mergeParams: true });
const CirclesRouter = router({ mergeParams: true });
const PermissionsRouter = router({ mergeParams: true });
const CampaignsRouter = router({ mergeParams: true });
const BodyCampaignsRouter = router({ mergeParams: true });
const PaymentsRouter = router({ mergeParams: true });

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

// Endpoints not requiring authorization.
GeneralRouter.get('/healthcheck', middlewares.healthcheck);
GeneralRouter.post('/signup/:campaign_id', campaigns.registerUser);
GeneralRouter.post('/confirm-email', register.confirmEmail);
GeneralRouter.post('/login', login.login);
GeneralRouter.post('/password_reset', login.passwordReset);
GeneralRouter.post('/password_confirm', login.passwordConfirm);
GeneralRouter.post('/renew', login.renew);

// Endpoints allowing unauthorized and authorized access.
GeneralRouter.use(middlewares.maybeAuthorize);
GeneralRouter.get('/bodies', bodies.listAllBodies);

// Endpoints not allowing unauthorized access.
// Not using this line here:
// GeneralRouter.use(middlewares.ensureAuthorized);
// because it'll also affect the middlewares for 404 and 500 errors.
GeneralRouter.get('/my_permissions', middlewares.ensureAuthorized, myPermissions.getMyPermissions);
GeneralRouter.post('/my_permissions', middlewares.ensureAuthorized, myPermissions.getMyCirclesWithPermission);
GeneralRouter.get('/members', middlewares.ensureAuthorized, members.listAllUsers);
GeneralRouter.post('/bodies', middlewares.ensureAuthorized, bodies.createBody);
GeneralRouter.get('/circles', middlewares.ensureAuthorized, circles.listAllCircles);
GeneralRouter.post('/circles', middlewares.ensureAuthorized, circles.createCircle);
GeneralRouter.get('/permissions', middlewares.ensureAuthorized, permissions.listAllPermissions);
GeneralRouter.post('/permissions', middlewares.ensureAuthorized, permissions.createPermission);
GeneralRouter.get('/campaigns', middlewares.ensureAuthorized, campaigns.listAllCampaigns);
GeneralRouter.post('/campaigns', middlewares.ensureAuthorized, campaigns.createCampaign);

// Everything related to a specific (maybe logged in) user. Auth only.
MemberRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchUser);
MemberRouter.get('/my_permissions', myPermissions.getMyPermissions);
MemberRouter.put('/active', members.setUserActive);
MemberRouter.put('/primary-body', members.setPrimaryBody);
MemberRouter.put('/password', members.setUserPassword);
MemberRouter.get('/', members.getUser);
MemberRouter.put('/', members.updateUser);
// MemberRouter.delete('/', members.deleteUser);

// Everything related to a specific body. Auth only (except for body details).
BodiesRouter.use(middlewares.maybeAuthorize, fetch.fetchBody);
BodiesRouter.get('/', bodies.getBody);
BodiesRouter.use(middlewares.ensureAuthorized);
BodiesRouter.get('/my_permissions', myPermissions.getMyPermissions);
BodiesRouter.get('/campaigns', bodyCampaigns.listAllCampaigns);
BodiesRouter.post('/campaigns', bodyCampaigns.createCampaign);
BodiesRouter.post('/circles', bodies.createBoundCircle);
BodiesRouter.get('/members', memberships.listAllMemberships);
BodiesRouter.delete('/members', memberships.deleteOwnMembership);
BodiesRouter.post('/create-member', bodies.createMember);
BodiesRouter.get('/join-requests', joinRequests.listAllJoinRequests);
BodiesRouter.post('/join-requests', joinRequests.createJoinRequest);
BodiesRouter.get('/payments', payments.listAllPayments);
BodiesRouter.post('/payments', payments.createPayment);
BodiesRouter.put('/status', bodies.setBodyStatus);
BodiesRouter.put('/', bodies.updateBody);

// Everything related to a specific body membership. Auth only.
MembershipsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchBody, fetch.fetchMembership);
MembershipsRouter.put('/', memberships.updateMembership);
MembershipsRouter.delete('/', memberships.deleteMembership);

// Everything related to a specific body membership. Auth only.
JoinRequestsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchBody, fetch.fetchJoinRequest);
JoinRequestsRouter.put('/status', joinRequests.changeRequestStatus);

// Everything related to a specific circle. Auth only.
CirclesRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchCircle);
CirclesRouter.get('/', circles.getCircle);
CirclesRouter.put('/parent', circles.setParentCircle);
CirclesRouter.post('/members/:user_id', circles.createCircleMembership);
CirclesRouter.put('/', circles.updateCircle);
CirclesRouter.delete('/', circles.deleteCircle);

// Everything related to a specific permission. Auth only.
PermissionsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchPermission);
PermissionsRouter.get('/', permissions.getPermission);
PermissionsRouter.get('/members', permissions.getPermissionMembers);
PermissionsRouter.put('/', permissions.updatePermission);
PermissionsRouter.delete('/', permissions.deletePermission);

// Everything related to a specific campaign. Auth only.
CampaignsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchCampaign);
CampaignsRouter.get('/', campaigns.getCampaign);
CampaignsRouter.put('/', campaigns.updateCampaign);
CampaignsRouter.delete('/', campaigns.deleteCampaign);

// Everything related to a specific body campaign. Auth only.
BodyCampaignsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchBody, fetch.fetchBodyCampaign);
BodyCampaignsRouter.get('/', bodyCampaigns.getCampaign);
BodyCampaignsRouter.put('/', bodyCampaigns.updateCampaign);
BodyCampaignsRouter.delete('/', bodyCampaigns.deleteCampaign);

// Everything related to a specific payment. Auth only.
PaymentsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchBody, fetch.fetchPayment);
PaymentsRouter.put('/', payments.updatePayment);
PaymentsRouter.delete('/', payments.deletePayment);

server.use('/members/:user_id', MemberRouter);
server.use('/bodies/:body_id/members/:membership_id', MembershipsRouter);
server.use('/bodies/:body_id/join-requests/:request_id', JoinRequestsRouter);
server.use('/bodies/:body_id/campaigns/:campaign_id', BodyCampaignsRouter);
server.use('/bodies/:body_id/payments/:payment_id', PaymentsRouter);
server.use('/bodies/:body_id', BodiesRouter);
server.use('/circles/:circle_id', CirclesRouter);
server.use('/permissions/:permission_id', PermissionsRouter);
server.use('/campaigns/:campaign_id', CampaignsRouter);
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

            // no need it in test
            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'test') {
                await cron.registerAllTasks();
                log.info('All cron tasks are registered.');
            }

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
