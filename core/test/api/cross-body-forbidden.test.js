const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { Permission } = require('../../models');
const {
    OPERATIONS,
    createFixtures,
    buildPath,
    snapshot
} = require('../scripts/route-table');

// The routes that a permission in the local scope opens, with that permission. A local
// permission counts in the body whose circle gives it: for the routes of that body, for
// the circles of that body, and for the members of that body.
const LOCAL_PERMISSIONS = {
    // Routes of a body.
    updateBody: 'update:body',
    listBodyCampaigns: 'view:campaign',
    createBodyCampaign: 'create:campaign',
    getBodyCampaign: 'view:campaign',
    updateBodyCampaign: 'update:campaign',
    deleteBodyCampaign: 'delete:campaign',
    listBodyCampaignMembers: 'view:member',
    createBodyCircle: 'create:circle',
    listBodyMemberships: 'view_members:body',
    createBodyMembership: 'add_member:body',
    createBodyMember: 'create_member:body',
    getBodyMembership: 'view_members:body',
    updateBodyMembership: 'update_member:body',
    deleteBodyMembership: 'delete_member:body',
    listJoinRequests: 'view:join_request',
    setJoinRequestStatus: 'process:join_request',
    listPayments: 'view:payment',
    createPayment: 'create:payment',
    updatePayment: 'update:payment',
    deletePayment: 'delete:payment',
    // Routes of a circle of a body.
    updateCircle: 'update:circle',
    deleteCircle: 'delete:circle',
    listCircleMemberships: 'view_members:circle',
    createCircleMembership: 'add_member:circle',
    getCircleMembership: 'view_members:circle',
    updateCircleMembership: 'update_members:circle',
    deleteCircleMembership: 'delete_members:circle',
    // Routes of a member of a body.
    getMember: 'view:member',
    lookupMember: 'lookup:member',
    updateMember: 'update:member',
    deleteMember: 'delete:member',
    setMemberActive: 'update_active:user',
    setPrimaryBody: 'update:member',
    requestEmailChange: 'update:member',
    setMemberPassword: 'update:member',
    uploadMemberImage: 'update:member',
    deleteMemberImage: 'update:member'
};

const rows = OPERATIONS
    .filter((operation) => LOCAL_PERMISSIONS[operation.operationId])
    .map((operation) => ({ operation, permission: LOCAL_PERMISSIONS[operation.operationId], title: operation.title }));

describe('Local permissions and other bodies', () => {
    let data;
    let caller;
    let token;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    // The fixtures have a body with a circle, a member, a campaign, a payment and a join
    // request, which the paths point at, and another body. The caller is nobody special.
    beforeEach(async () => {
        mock.mockAll();
        data = await createFixtures();
        caller = await generator.createUser();
        token = await generator.createAccessToken(caller);
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    // Makes the caller a member of a circle of the body that has the permission in the local scope.
    const grant = async (body, permission) => {
        const [action, object] = permission.split(':');
        // The fixtures have one of these already.
        const row = await Permission.findOne({ where: { scope: 'local', action, object } })
            || await generator.createPermission({ scope: 'local', action, object });
        const circle = await generator.createCircle({ body_id: body.id });

        await generator.createBodyMembership(body, caller);
        await generator.createCircleMembership(circle, caller);
        await generator.createCirclePermission(circle, row);
    };

    const send = (operation) => request({
        path: buildPath(operation, data),
        method: operation.method,
        headers: { 'X-Auth-Token': token.value },
        body: operation.body ? operation.body(data) : undefined
    });

    test('covers every route that a local permission opens', () => {
        // The other routes with a permission ask for it in the global scope, or for none.
        expect(rows.length).toEqual(Object.keys(LOCAL_PERMISSIONS).length);
        expect(rows.length).toEqual(37);
    });

    test.each(rows)('$title answers 403 with $permission in another body', async ({ operation, permission }) => {
        await grant(data.otherBody, permission);
        const before = await snapshot();

        const res = await send(operation);

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: `Permission ${permission} is required, but not present.` });
        expect(await snapshot()).toEqual(before);
    });

    // The same request with the permission in the body it is about: the 403 above is for the
    // body, not for the route. (One of the routes then refuses for another reason: the fixtures
    // ask to add somebody to a circle of a body they are not in.)
    test.each(rows)('$title is let through with $permission in the same body', async ({ operation, permission }) => {
        await grant(data.body, permission);

        const res = await send(operation);

        expect(res.statusCode).not.toEqual(401);
        expect(res.statusCode).toBeLessThan(500);
        expect(res.body.message).not.toEqual(`Permission ${permission} is required, but not present.`);

        if (operation.operationId !== 'createCircleMembership') {
            expect(res.statusCode).not.toEqual(403);
        }
    });

    test.each(rows)('$title answers 403 without any permission', async ({ operation, permission }) => {
        const before = await snapshot();

        const res = await send(operation);

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: `Permission ${permission} is required, but not present.` });
        expect(await snapshot()).toEqual(before);
    });
});
