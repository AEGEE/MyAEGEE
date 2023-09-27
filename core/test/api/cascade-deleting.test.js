const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const {
    Circle,
    CircleMembership,
    CirclePermission,
    AccessToken,
    RefreshToken,
    MailConfirmation,
    User,
    Body
} = require('../../models');

describe('Cascade deleting', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    describe('Circles deleting', () => {
        test('should nullify the parent circle of its child circle', async () => {
            const parentCircle = await generator.createCircle();
            const childCircle = await generator.createCircle({}, parentCircle);

            await parentCircle.destroy();

            const circleFromDb = await Circle.findByPk(childCircle.id);
            expect(circleFromDb.parent_circle_id).toEqual(null);
        });

        test('should delete all circle memberships', async () => {
            const user = await generator.createUser();
            const circle = await generator.createCircle();
            const membership = await generator.createCircleMembership(circle, user);

            await circle.destroy();

            const membershipFromDb = await CircleMembership.findByPk(membership.id);
            expect(membershipFromDb).toEqual(null);
        });

        test('should delete all circle permission', async () => {
            const circle = await generator.createCircle();
            const permission = await generator.createPermission();
            const circlePermission = await generator.createCirclePermission(circle, permission);

            await circle.destroy();

            const circlePermissionFromDb = await CirclePermission.findByPk(circlePermission.id);
            expect(circlePermissionFromDb).toEqual(null);
        });

        test('should nullify all the bodies\' shadow circles', async () => {
            const circle = await generator.createCircle();
            const body = await generator.createBody({ shadow_circle_id: circle.id });

            await circle.destroy();

            const bodyFromDb = await Body.findByPk(body.id);
            expect(bodyFromDb.shadow_circle_id).toEqual(null);
        });
    });

    describe('Permissions deleting', () => {
        test('should delete all circle permission', async () => {
            const circle = await generator.createCircle();
            const permission = await generator.createPermission();
            const circlePermission = await generator.createCirclePermission(circle, permission);

            await permission.destroy();

            const circlePermissionFromDb = await CirclePermission.findByPk(circlePermission.id);
            expect(circlePermissionFromDb).toEqual(null);
        });
    });

    describe('Users deleting', () => {
        test('should delete all circle memberships', async () => {
            const user = await generator.createUser();
            const circle = await generator.createCircle();
            const membership = await generator.createCircleMembership(circle, user);

            await user.destroy();

            const membershipFromDb = await CircleMembership.findByPk(membership.id);
            expect(membershipFromDb).toEqual(null);
        });

        test('should delete all access tokens', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            await user.destroy();

            const tokenFromDb = await AccessToken.findByPk(token.id);
            expect(tokenFromDb).toEqual(null);
        });

        test('should delete all refresh tokens', async () => {
            const user = await generator.createUser();
            const token = await generator.createRefreshToken(user);

            await user.destroy();

            const tokenFromDb = await RefreshToken.findByPk(token.id);
            expect(tokenFromDb).toEqual(null);
        });

        test('should delete all mail confirmations', async () => {
            const user = await generator.createUser();
            const confirmation = await generator.createMailConfirmation(user);

            await user.destroy();

            const confirmationFromDb = await MailConfirmation.findByPk(confirmation.id);
            expect(confirmationFromDb).toEqual(null);
        });
    });

    describe('Campaigns deleting', () => {
        test('should nullify all the users\' campaigns', async () => {
            const campaign = await generator.createCampaign();
            const user = await generator.createUser({ campaign_id: campaign.id });

            await campaign.destroy();

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.campaign_id).toEqual(null);
        });
    });

    describe('Bodies deleting', () => {
        test('should nullify all the circles\' body', async () => {
            const body = await generator.createBody();
            const circle = await generator.createCircle({ body_id: body.id });

            await body.destroy();

            const circleFromDb = await Circle.findByPk(circle.id);
            expect(circleFromDb.body_id).toEqual(null);
        });
    });
});
