// Adds e2e fixtures on top of the core seed:
// - privacy consent for all seeded users,
// - production circle permissions for NetCom and the general members circle,
// - a second antenna with its own member, who shares no body with NetCom.
// Run with NODE_ENV=e2e after core/scripts/seed.js (scripts/prepare.js does both).
if (process.env.NODE_ENV !== 'e2e') {
    throw new Error('The e2e fixtures replace circle permissions and only run with NODE_ENV=e2e.');
}

const {
    User,
    Body,
    Circle,
    Permission,
    CirclePermission,
    BodyMembership
} = require('../../core/models');
const { authenticate, close } = require('../../core/lib/sequelize');
const { PASSWORD, USERS, SECOND_ANTENNA, PROD_CIRCLE_PERMISSIONS } = require('../support/constants');

async function findOrCreatePermission(combined) {
    const [scope, action, object] = combined.split(':');
    const [permission] = await Permission.findOrCreate({
        where: { scope, action, object },
        defaults: { scope, action, object, description: `${combined} (e2e fixture)` }
    });
    return permission;
}

async function applyProdCirclePermissions() {
    for (const [circleName, combinedList] of Object.entries(PROD_CIRCLE_PERMISSIONS)) {
        const circle = await Circle.findOne({ where: { name: circleName, body_id: null } });
        if (!circle) {
            throw new Error(`Circle "${circleName}" not found, did the core seed run?`);
        }

        // The seed nests some circles (e.g. NetCom under the other board circle); production
        // doesn't, and the circle should have exactly these permissions.
        await circle.update({ parent_circle_id: null });
        await CirclePermission.destroy({ where: { circle_id: circle.id } });
        for (const combined of combinedList) {
            const permission = await findOrCreatePermission(combined);
            await CirclePermission.create({ circle_id: circle.id, permission_id: permission.id });
        }
    }
}

async function createSecondAntenna() {
    const body = await Body.create({
        name: SECOND_ANTENNA.name,
        code: SECOND_ANTENNA.code,
        description: 'Second antenna for e2e tests',
        type: 'antenna',
        phone: '1-800-111-11-11',
        address: 'Somewhere in Europe',
        founded_at: '1970-01-01',
        email: 'e2e-second@example.com'
    });

    const parentMembersCircle = await Circle.findOne({ where: { name: 'General members circle', body_id: null } });
    const membersCircle = await Circle.create({
        name: `Members ${body.name}`,
        description: `Members ${body.name}`,
        parent_circle_id: parentMembersCircle.id,
        body_id: body.id
    });
    await body.update({ shadow_circle_id: membersCircle.id });

    const organizer = await User.create({
        first_name: 'Organizer',
        last_name: 'Bravo',
        username: USERS.organizerB,
        email: `${USERS.organizerB}@example.com`,
        password: PASSWORD,
        about_me: 'Member of the second antenna only',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });
    await BodyMembership.create({ body_id: body.id, user_id: organizer.id });
}

authenticate().then(async () => {
    // Real users have agreed to the privacy policy; without it the frontend only shows the consent form.
    await User.update({ privacy_consent: new Date() }, { where: {} });
    await applyProdCirclePermissions();
    await createSecondAntenna();
    await close();
}).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[e2e fixtures] failed:', err);
    process.exit(1);
});
