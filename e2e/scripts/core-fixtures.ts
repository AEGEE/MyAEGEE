// Adds e2e fixtures on top of the core seed (which already models the production circles):
// - a second antenna with its own member, who shares no body with NetCom;
// - a circle that lets regular members create Summer Universities (not in production).
// Run with NODE_ENV=e2e after core/scripts/seed.js (scripts/prepare.ts does both).
import { PASSWORD, USERS, SECOND_ANTENNA, SU_CREATORS_CIRCLE } from '../support/constants.ts';
import { loadCoreModels, loadCoreSequelize } from '../support/core.ts';

if (process.env.NODE_ENV !== 'e2e') {
    throw new Error('The e2e fixtures change the core database and only run with NODE_ENV=e2e.');
}

const { User, Body, Circle, Permission, CirclePermission, BodyMembership, CircleMembership } = loadCoreModels();
const { authenticate, close } = loadCoreSequelize();

async function createSecondAntenna(): Promise<void> {
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

    // Like the seeded antennas, its members get the general members circle's permissions.
    const parentMembersCircle = await Circle.findOne({ where: { name: 'General members circle', body_id: null } });
    if (!parentMembersCircle) {
        throw new Error('Circle "General members circle" not found, did the core seed run?');
    }

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

async function createSummerUniversityCreators(): Promise<void> {
    const circle = await Circle.create({ name: SU_CREATORS_CIRCLE.name, description: 'e2e fixture' });
    for (const combined of SU_CREATORS_CIRCLE.permissions) {
        const [scope, action, object] = combined.split(':');
        const permission = await Permission.findOne({ where: { scope, action, object } });
        if (!permission) {
            throw new Error(`Permission ${combined} not found, did the core seed run?`);
        }
        await CirclePermission.create({ circle_id: circle.id, permission_id: permission.id });
    }

    for (const username of SU_CREATORS_CIRCLE.members) {
        const user = await User.findOne({ where: { username } });
        await CircleMembership.create({ circle_id: circle.id, user_id: user.id });
    }
}

try {
    await authenticate();
    await createSecondAntenna();
    await createSummerUniversityCreators();
    await close();
} catch (err) {
    console.error('[e2e fixtures] failed:', err);
    process.exit(1);
}
