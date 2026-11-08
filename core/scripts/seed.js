const fs = require('fs');
const path = require('path');
const moment = require('moment');

const { authenticate, close } = require('../lib/sequelize');
const logger = require('../lib/logger');
const { PERMISSIONS, CIRCLE_PERMISSIONS } = require('./seed-permissions');
const {
    User,
    Body,
    Circle,
    Permission,
    CircleMembership,
    CirclePermission,
    BodyMembership,
    Campaign,
    MailConfirmation,
    PasswordReset
} = require('../models');

const seedStatePath = path.resolve(__dirname, '../state/.seed-executed-' + (process.env.NODE_ENV || 'development'));

const data = {};

async function createAdmin() {
    return User.create({
        first_name: 'Admin',
        last_name: 'Admin',
        username: 'admin',
        email: 'admin@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'I\'m the superadmin of the system, please do not remove me.',
        date_of_birth: '1970-01-01',
        gender: 'machine',
        address: 'Somewhere in the cloud',
        superadmin: true,
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });
}

async function createBodies() {
    const types = [
        'Antenna',
        'Contact antenna',
        'Contact',
        'Interest Group',
        'Working Group',
        'Commission',
        'Committee',
        'Project',
        'Partner',
        'External',
        'Other'
    ];

    const codes = [
        'ANT',
        'COA',
        'CON',
        'INT',
        'WRK',
        'COS',
        'COT',
        'PRO',
        'PAR',
        'EXT',
        'OTH'
    ];

    const bodies = [];

    types.forEach(async (type, i) => {
        const typeLowerCase = type.toLowerCase();
        bodies.push(await Body.create({
            name: 'AEGEE-' + type,
            code: codes[i],
            description: type,
            type: typeLowerCase,
            phone: '1-800-111-11-11',
            address: 'Somewhere in Europe',
            founded_at: '1970-01-01',
            email: typeLowerCase.replace(' ', '') + '@example.com'
        }));
    });

    bodies.push(await Body.create({
        name: 'Network Commission',
        code: 'XNE',
        description: 'Network Commission',
        type: 'commission',
        phone: '1-800-111-11-11',
        address: 'Somewhere in Europe',
        founded_at: '1970-01-01',
        email: 'netcom@example.com'
    }));

    return bodies;
}

async function createCircles() {
    const circles = {
        members: [],
    };

    circles.boardCircle = await Circle.create({
        name: 'General board circle',
        description: 'Parent board circle'
    });

    circles.otherBoardCircle = await Circle.create({
        name: 'General other board circle',
        description: 'Parent other board circle'
    });

    circles.membersCircle = await Circle.create({
        name: 'General members circle',
        description: 'Parent members circle'
    });

    circles.adminCircle = await Circle.create({
        name: 'General admin circle',
        description: 'Parent admin circle'
    });

    circles.comiteDirecteurCircle = await Circle.create({
        name: 'Comite Directeur',
        description: 'Comite Directeur circle',
        parent_circle_id: circles.otherBoardCircle.id
    });

    circles.networkDirectorCircle = await Circle.create({
        name: 'Network Director',
        description: 'Network Director circle'
    });

    circles.financialDirectorCircle = await Circle.create({
        name: 'Financial Director',
        description: 'Financial Director circle'
    });

    circles.suctCircle = await Circle.create({
        name: 'Summer University Coordination Team',
        description: 'Summer University Coordination Team circle',
        parent_circle_id: circles.otherBoardCircle.id
    });

    circles.eqacCircle = await Circle.create({
        name: 'Events Quality Assurance Committee',
        description: 'Events Quality Assurance Committee circle',
        parent_circle_id: circles.membersCircle.id
    });

    circles.chairsCircle = await Circle.create({
        name: 'Chairs',
        description: 'The Chair and Vice-Chair are elected by the Agora',
        parent_circle_id: circles.otherBoardCircle.id
    });

    circles.chairTeamMembersCircle = await Circle.create({
        name: 'Chair Team members',
        description: 'Chair Team members (including Job Shadowers and Assistants)',
        parent_circle_id: circles.membersCircle.id
    });

    circles.jcCircle = await Circle.create({
        name: 'Juridical Commission',
        description: 'Juridical Commission circle',
        parent_circle_id: circles.otherBoardCircle.id
    });

    circles.netcomCircle = await Circle.create({
        name: 'Network Commission',
        description: 'Network Commission circle',
        parent_circle_id: circles.otherBoardCircle.id
    });

    for (const body of data.bodies) {
        // Only the antenna gets a board circle.
        if (body.type === 'antenna') {
            circles.antennaBoardCircle = await Circle.create({
                name: `Board ${body.name}`,
                description: `Board ${body.name}`,
                parent_circle_id: circles.boardCircle.id,
                body_id: body.id
            });
        }

        // Only members of antennas, contact antennas and contacts get the general members permissions.
        const membersCircle = await Circle.create({
            name: `Members ${body.name}`,
            description: `Members ${body.name}`,
            parent_circle_id: ['antenna', 'contact antenna', 'contact'].includes(body.type) ? circles.membersCircle.id : null,
            body_id: body.id
        });

        await body.update({ shadow_circle_id: membersCircle.id });

        circles.members.push(membersCircle);
    }

    return circles;
}

async function createPermissions() {
    const permissions = await Permission.bulkCreate(PERMISSIONS, { individualHooks: true, validate: true });
    const permissionsByKey = new Map(permissions.map(
        (permission) => [`${permission.scope}:${permission.action}:${permission.object}`, permission]
    ));

    for (const [circleKey, keys] of Object.entries(CIRCLE_PERMISSIONS)) {
        for (const key of keys) {
            const permission = permissionsByKey.get(key);
            if (!permission) {
                throw new Error(`Permission ${key} of ${circleKey} is not seeded`);
            }

            await CirclePermission.create({ circle_id: data.circles[circleKey].id, permission_id: permission.id });
        }
    }

    return permissionsByKey;
}

async function createMembers() {
    const antenna = data.bodies.find((b) => b.type === 'antenna');
    const netcom = data.bodies.find((b) => b.name === 'Network Commission');

    const member = await User.create({
        first_name: 'A',
        last_name: 'Member',
        username: 'member',
        email: 'member@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'Imma regular member',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: member.id
    });

    const boardMember = await User.create({
        first_name: 'Board',
        last_name: 'Member',
        username: 'board',
        email: 'board@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'Imma board member',
        date_of_birth: '1970-01-01',
        gender: 'helicopter',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: boardMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.antennaBoardCircle.id,
        user_id: boardMember.id
    });

    const notMember = await User.create({
        first_name: 'Not A',
        last_name: 'Member',
        username: 'not-member',
        email: 'not-member@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'Imma no member',
        date_of_birth: '1970-01-01',
        gender: 'apache',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    const notConfirmedMember = await User.create({
        first_name: 'Not Confirmed',
        last_name: 'Member',
        username: 'not-confirmed',
        email: 'not-confirmed@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'I\'m not a confirrmed member',
        date_of_birth: '1970-01-01',
        gender: 'techno',
        address: 'Somewhere in Europe',
        mail_confirmed_at: null,
        privacy_consent: new Date()
    });

    await MailConfirmation.create({
        user_id: notConfirmedMember.id,
        value: '5ecr3t',
        expires_at: moment().add(10, 'year').toDate()
    });

    const passwordResetMember = await User.create({
        first_name: 'Password Reset',
        last_name: 'Member',
        username: 'password-reset',
        email: 'password-reset@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'I\'m a member who requested a password reset',
        date_of_birth: '1970-01-01',
        gender: 'earth',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await PasswordReset.create({
        user_id: passwordResetMember.id,
        expires_at: moment().add(10, 'year').toDate(),
        value: '5ecr3t'
    });

    const suspendedMember = await User.create({
        first_name: 'Suspended',
        last_name: 'Member',
        username: 'suspended',
        email: 'suspended@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'I\'m a member who is suspended',
        date_of_birth: '1970-01-01',
        gender: 'earth',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date(),
        active: false
    });

    const netcomMember = await User.create({
        first_name: 'NetCom',
        last_name: 'Member',
        username: 'netcom',
        email: 'netcom@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'A member of the Network Commission',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: netcomMember.id
    });

    await BodyMembership.create({
        body_id: netcom.id,
        user_id: netcomMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.netcomCircle.id,
        user_id: netcomMember.id
    });

    const ndMember = await User.create({
        first_name: 'Network',
        last_name: 'Director',
        username: 'nd',
        email: 'network@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'The ND of CD',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: ndMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.networkDirectorCircle.id,
        user_id: ndMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.comiteDirecteurCircle.id,
        user_id: ndMember.id
    });

    const fdMember = await User.create({
        first_name: 'Financial',
        last_name: 'Director',
        username: 'fd',
        email: 'treasurer@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'The FD of CD',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: fdMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.financialDirectorCircle.id,
        user_id: fdMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.comiteDirecteurCircle.id,
        user_id: fdMember.id
    });

    const suctMember = await User.create({
        first_name: 'SUCT',
        last_name: 'Member',
        username: 'suct',
        email: 'suct@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'Coordinating Summer Universities',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: suctMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.suctCircle.id,
        user_id: suctMember.id
    });

    const eqacMember = await User.create({
        first_name: 'EQAC',
        last_name: 'Member',
        username: 'eqac',
        email: 'eqac@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'Assuring the quality of events',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: eqacMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.eqacCircle.id,
        user_id: eqacMember.id
    });

    const chairMember = await User.create({
        first_name: 'Chair',
        last_name: 'Member',
        username: 'chair',
        email: 'chair@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'Chairing the Agora',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: chairMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.chairsCircle.id,
        user_id: chairMember.id
    });

    const chairJobShadowerMember = await User.create({
        first_name: 'Chair Job Shadower',
        last_name: 'Member',
        username: 'chair-jobshadower',
        email: 'chair-jobshadower@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'Job shadowing the Chair Team',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: chairJobShadowerMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.chairTeamMembersCircle.id,
        user_id: chairJobShadowerMember.id
    });

    const juridicalMember = await User.create({
        first_name: 'Juridical',
        last_name: 'Member',
        username: 'juridical',
        email: 'juridical@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'Member of the Juridical Commission',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date(),
        privacy_consent: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: juridicalMember.id
    });

    await CircleMembership.create({
        circle_id: data.circles.jcCircle.id,
        user_id: juridicalMember.id
    });

    // The only seeded user without privacy consent, to test the consent form.
    const noConsentMember = await User.create({
        first_name: 'No Consent',
        last_name: 'Member',
        username: 'no-consent',
        email: 'no-consent@example.com',
        password: '5ecr3t5ecr3t',
        about_me: 'I have not agreed to the privacy policy yet',
        date_of_birth: '1970-01-01',
        gender: 'neutral',
        address: 'Somewhere in Europe',
        mail_confirmed_at: new Date()
    });

    await BodyMembership.create({
        body_id: antenna.id,
        user_id: noConsentMember.id
    });

    return {
        member,
        boardMember,
        notMember,
        notConfirmedMember,
        passwordResetMember,
        suspendedMember,
        netcomMember,
        ndMember,
        fdMember,
        suctMember,
        eqacMember,
        chairMember,
        chairJobShadowerMember,
        juridicalMember,
        noConsentMember
    };
}

async function createCampaign() {
    return Campaign.create({
        name: 'Sign up',
        url: 'default',
        description_short: 'Sign up here',
        description_long: '... and join the effort!',
        activate_user: true
    });
}

if (fs.existsSync(seedStatePath)) {
    logger.info('[seeds         ]: Seed was executed already, no need to run it again.');
    process.exit(0);
}

if (process.env.NODE_ENV === 'production') {
    logger.error('Not running seeds in production.');
    process.exit(0);
}

authenticate().then(async () => {
    logger.info('[seeds         ]: DB connected');

    logger.info('[seeds         ]: Create admins');
    data.admin = await createAdmin();

    logger.info('[seeds         ]: Create bodies');
    data.bodies = await createBodies();

    logger.info('[seeds         ]: Create circles');
    data.circles = await createCircles();

    logger.info('[seeds         ]: Create permissions');
    data.permissions = await createPermissions();

    logger.info('[seeds         ]: Create members');
    data.members = await createMembers();

    logger.info('[seeds         ]: Create campaign');
    data.campaign = await createCampaign();

    await close();
}).catch((err) => {
    logger.error(`[seeds         ]: Seed creation error: ${err}`);
    process.exit(1);
});
