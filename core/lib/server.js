const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');
const boolParser = require('express-query-boolean');

const morgan = require('./morgan');
const db = require('./sequelize');
const log = require('./logger');
const config = require('../config');
const Bugsnag = require('./bugsnag');
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
const bodyMemberships = require('../middlewares/body-memberships');
const joinRequests = require('../middlewares/join-requests');
const bodyCampaigns = require('../middlewares/body-campaigns');
const payments = require('../middlewares/payments');
const circleMemberships = require('../middlewares/circle-memberships');
const circlePermissions = require('../middlewares/circle-permissions');
const endpointsMetrics = require('../middlewares/endpoint-metrics');
const metrics = require('../middlewares/metrics');

const GeneralRouter = router({ mergeParams: true });
const MemberRouter = router({ mergeParams: true });
const BodiesRouter = router({ mergeParams: true });
const BodyMembershipsRouter = router({ mergeParams: true });
const JoinRequestsRouter = router({ mergeParams: true });
const CirclesRouter = router({ mergeParams: true });
const PermissionsRouter = router({ mergeParams: true });
const CampaignsRouter = router({ mergeParams: true });
const BodyCampaignsRouter = router({ mergeParams: true });
const PaymentsRouter = router({ mergeParams: true });
const CircleMembershipsRouter = router({ mergeParams: true });

const server = express();
server.use(bodyParser.json());
server.use(morgan);
server.use(boolParser());

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error('Unhandled rejection: ', err);

    if (process.env.NODE_ENV !== 'test') {
        Bugsnag.notify(err);
    }
});

// Endpoints not requiring authorization.
GeneralRouter.get('/healthcheck', middlewares.healthcheck);
GeneralRouter.get('/metrics', metrics.getMetrics);
GeneralRouter.get('/metrics/requests', endpointsMetrics.getEndpointMetrics);
GeneralRouter.post('/signup/:campaign_id', campaigns.registerUser);
GeneralRouter.post('/confirm-email', register.confirmEmail);
GeneralRouter.post('/confirm-email-change', members.confirmEmailChange);
GeneralRouter.post('/login', login.login);
GeneralRouter.post('/logout', login.logout);
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
GeneralRouter.get('/members_search', middlewares.ensureAuthorized, members.searchAllUsers);
GeneralRouter.get('/members_email', middlewares.ensureAuthorized, members.getUsersEmail);
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
MemberRouter.put('/superadmin', members.setUserSuperadmin);
MemberRouter.post('/confirm', members.confirmUser);
MemberRouter.put('/primary-body', members.setPrimaryBody);
MemberRouter.put('/email', members.triggerEmailChange);
MemberRouter.put('/password', members.setUserPassword);
MemberRouter.get('/', members.getUser);
MemberRouter.put('/', members.updateUser);
MemberRouter.delete('/', members.deleteUser);

// Everything related to a specific body. Auth only (except for body details).
BodiesRouter.use(middlewares.maybeAuthorize, fetch.fetchBody);
BodiesRouter.get('/', bodies.getBody);
BodiesRouter.use(middlewares.ensureAuthorized);
BodiesRouter.get('/my_permissions', myPermissions.getMyPermissions);
BodiesRouter.get('/campaigns', bodyCampaigns.listAllCampaigns);
BodiesRouter.post('/campaigns', bodyCampaigns.createCampaign);
BodiesRouter.post('/circles', bodies.createBoundCircle);
BodiesRouter.get('/members', bodyMemberships.listAllMemberships);
BodiesRouter.post('/members', bodyMemberships.createMembership);
BodiesRouter.delete('/members', bodyMemberships.deleteOwnMembership);
BodiesRouter.post('/create-member', bodies.createMember);
BodiesRouter.get('/join-requests', joinRequests.listAllJoinRequests);
BodiesRouter.post('/join-requests', joinRequests.createJoinRequest);
BodiesRouter.get('/payments', payments.listAllPayments);
BodiesRouter.post('/payments', payments.createPayment);
BodiesRouter.put('/status', bodies.setBodyStatus);
BodiesRouter.put('/', bodies.updateBody);

// Everything related to a specific body membership. Auth only.
BodyMembershipsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchBody, fetch.fetchMembership);
BodyMembershipsRouter.get('/', bodyMemberships.getMembership);
BodyMembershipsRouter.put('/', bodyMemberships.updateMembership);
BodyMembershipsRouter.delete('/', bodyMemberships.deleteMembership);

// Everything related to a specific body membership. Auth only.
JoinRequestsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchBody, fetch.fetchJoinRequest);
JoinRequestsRouter.put('/status', joinRequests.changeRequestStatus);

// Everything related to a specific circle. Auth only.
CirclesRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchCircle);
CirclesRouter.get('/my_permissions', myPermissions.getMyPermissions);
CirclesRouter.get('/permissions', circles.getCirclePermissions);
CirclesRouter.post('/permissions', circlePermissions.addPermission);
CirclesRouter.delete('/permissions/:permission_id', circlePermissions.deletePermission);
CirclesRouter.get('/', circles.getCircle);
CirclesRouter.put('/parent', circles.setParentCircle);
CirclesRouter.get('/members', circleMemberships.listCircleMembers);
CirclesRouter.post('/members', circleMemberships.createMembership);
CirclesRouter.delete('/members', circleMemberships.deleteOwnMembership);
CirclesRouter.put('/', circles.updateCircle);
CirclesRouter.delete('/', circles.deleteCircle);

// Everything related to a specific circle membership. Auth only.
CircleMembershipsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchCircle, fetch.fetchCircleMembership);
CircleMembershipsRouter.get('/', circleMemberships.getMembership);
CircleMembershipsRouter.put('/', circleMemberships.updateMembership);
CircleMembershipsRouter.delete('/', circleMemberships.deleteMembership);

// Everything related to a specific permission. Auth only.
PermissionsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchPermission);
PermissionsRouter.get('/', permissions.getPermission);
PermissionsRouter.get('/members', permissions.getPermissionMembers);
PermissionsRouter.put('/', permissions.updatePermission);
PermissionsRouter.delete('/', permissions.deletePermission);

// Everything related to a specific campaign. Auth only.
CampaignsRouter.use(middlewares.maybeAuthorize, fetch.fetchCampaign);
CampaignsRouter.get('/', campaigns.getCampaign);
CampaignsRouter.use(middlewares.ensureAuthorized);
CampaignsRouter.get('/members', campaigns.listCampaignMembers);
CampaignsRouter.get('/', campaigns.getCampaign);
CampaignsRouter.put('/', campaigns.updateCampaign);
CampaignsRouter.delete('/', campaigns.deleteCampaign);

// Everything related to a specific body campaign. Auth only.
BodyCampaignsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchBody, fetch.fetchBodyCampaign);
BodyCampaignsRouter.get('/members', bodyCampaigns.listCampaignMembers);
BodyCampaignsRouter.get('/', bodyCampaigns.getCampaign);
BodyCampaignsRouter.put('/', bodyCampaigns.updateCampaign);
BodyCampaignsRouter.delete('/', bodyCampaigns.deleteCampaign);

// Everything related to a specific payment. Auth only.
PaymentsRouter.use(middlewares.maybeAuthorize, middlewares.ensureAuthorized, fetch.fetchBody, fetch.fetchPayment);
PaymentsRouter.put('/', payments.updatePayment);
PaymentsRouter.delete('/', payments.deletePayment);

server.use(endpointsMetrics.addEndpointMetrics);
server.get('/members/unconfirmed', middlewares.maybeAuthorize, middlewares.ensureAuthorized, members.listAllUnconfirmedUsers);
server.use('/members/:user_id', MemberRouter);
server.use('/bodies/:body_id/members/:membership_id', BodyMembershipsRouter);
server.use('/bodies/:body_id/join-requests/:request_id', JoinRequestsRouter);
server.use('/bodies/:body_id/campaigns/:campaign_id', BodyCampaignsRouter);
server.use('/bodies/:body_id/payments/:payment_id', PaymentsRouter);
server.use('/bodies/:body_id', BodiesRouter);
server.use('/circles/:circle_id/members/:membership_id', CircleMembershipsRouter);
server.use('/circles/:circle_id', CirclesRouter);
server.use('/permissions/:permission_id', PermissionsRouter);
server.use('/campaigns/:campaign_id', CampaignsRouter);
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
