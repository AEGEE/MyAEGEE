const fs = require('fs');
const path = require('path');
const moment = require('moment');

const { authenticate, close } = require('../lib/sequelize');
const logger = require('../lib/logger');
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
        mail_confirmed_at: new Date()
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
    return bodies;
}

async function createCircles() {
    const circles = {
        board: [],
        members: [],
    };

    circles.boardCircle = await Circle.create({
        name: 'General board circle',
        description: 'Parent board circle'
    });

    circles.membersCircle = await Circle.create({
        name: 'General members circle',
        description: 'Parent members circle'
    });

    circles.adminCircle = await Circle.create({
        name: 'General admin circle',
        description: 'Parent admin circle'
    });

    for (const body of data.bodies) {
        const boardCircle = await Circle.create({
            name: `Board ${body.name}`,
            description: `Board ${body.name}`,
            parent_circle_id: circles.boardCircle.id,
            body_id: body.id
        });

        const membersCircle = await Circle.create({
            name: `Members ${body.name}`,
            description: `Members ${body.name}`,
            parent_circle_id: circles.membersCircle.id,
            body_id: body.id
        });

        await body.update({ shadow_circle_id: membersCircle.id });

        circles.board.push(boardCircle);
        circles.members.push(membersCircle);

        if (body.type === 'antenna') {
            circles.antennaMembersCircle = membersCircle;
            circles.antennaBoardCircle = boardCircle;
        }
    }

    return circles;
}

async function createPermissions() {
    const permissions = {};

    permissions.members = await Permission.bulkCreate([{
        scope: 'global',
        object: 'circle',
        description: 'Allows to join circles which are joinable. Non-joinable circles can never be joined',
        action: 'join'
    }, {
        scope: 'local',
        object: 'body',
        description: 'View the members in the body that you got that permission from',
        action: 'view_members',
    }, {
        scope: 'local',
        object: 'circle',
        description: 'View members of any circle in the body that you got this permission from',
        action: 'view_members'
    }, {
        scope: 'local',
        object: 'member',
        description: 'View information about all members in the body. This does not allow you to perform a members listing, you might however hold the list:body_memberships permission to perform a members listing of the members in the body',
        action: 'view'
    }, {
        scope: 'global',
        object: 'event',
        description: 'Display links to \'Create event\' everywhere, so people who are not members of any body cannot see it.',
        action: 'create'
    }], { individualHooks: true, validate: true });

    const boardPermissions = await Permission.bulkCreate([
        {
            scope: 'local',
            object: 'body',
            action: 'delete_member',
            description: 'Delete membership status from members in the body that you got this permission from.'
        },
        {
            scope: 'local',
            object: 'body',
            action: 'update',
            description: 'Update details of the body that you got the permission from. Might be good for boards, as long as name and legacy key are filtered.'
        },
        {
            scope: 'local',
            object: 'body',
            action: 'update_member',
            description: 'Change the data attached to a body membership in the body you got this permission from'
        },
        {
            scope: 'local',
            object: 'bound_circle',
            action: 'create',
            description: 'Creating bound circles to the body the permission was granted in'
        },
        {
            scope: 'local',
            object: 'circle',
            action: 'add_member',
            description: 'Add any member of the body you got this permission from to any bound circle in that body, no matter if the circle is joinable or not or if the member wants that or not. This also allows to add yourself to any circle so only give it to people who anyways have many rights in the body'
        },
        {
            scope: 'local',
            object: 'join_request',
            action: 'process',
            description: 'Process join requests in the body that you got the permission from'
        },
        {
            scope: 'local',
            object: 'join_request',
            action: 'view',
            description: 'View join request to the body you got this permission from'
        },
        {
            scope: 'local',
            object: 'member',
            action: 'create',
            description: 'Creates a member to the local that this permission was granted in'
        },
        {
            scope: 'local',
            object: 'circle',
            action: 'delete_members',
            description: 'Delete any member from any circle in the body that you got this permission from, even those that you are not in a circle_admin position in or even have member status. Should never be assigned as circle_admins automatically get this permission'
        },
        {
            scope: 'local',
            object: 'circle',
            action: 'update_members',
            description: 'Update membership details of members of any circle in the body that you got this permission from, even those that you are not in a circle_admin position in or even have member status. Should never be assigned as circle_admins automatically get this permission'
        },
        {
            scope: 'local',
            object: 'epm',
            action: 'approve_members',
            description: 'Approve members for a local/manage memberslists for a local for EPM'
        },
        {
            scope: 'local',
            object: 'campaign',
            action: 'view',
            description: 'View recruitment campaigns attached to a body'
        },
        {
            scope: 'local',
            object: 'campaign',
            action: 'create',
            description: 'Create a bound campaign. You must hold this permission in the local that you want to bind this campaign to.'
        },
        {
            scope: 'local',
            object: 'campaign',
            action: 'update',
            description: 'Update a campaign in the body which you got this permission from.'
        },
        {
            scope: 'local',
            object: 'campaign',
            action: 'delete',
            description: 'Delete a recruitment campaign which is bound to the body that you got this permission from'
        },
        {
            scope: 'local',
            object: 'events',
            action: 'approve_members',
            description: 'Put board comments for member for general events (non-statutory and SUs). For board members.'
        },
        {
            scope: 'local',
            object: 'agora',
            action: 'approve_members',
            description: 'Set pax type/order and board comment for Agora applications.'
        },
        {
            scope: 'local',
            object: 'payment',
            action: 'view',
            description: "View payments for the body you've got this permission from."
        },
        {
            scope: 'local',
            object: 'payment',
            action: 'create',
            description: 'Create payments in the body you\'ve got this permission from.'
        },
        {
            scope: 'local',
            object: 'su_module',
            action: 'level2_access',
            description: 'Gives you access to all board functions in the SU module'
        },
        {
            scope: 'join_request',
            object: 'member',
            action: 'view',
            description: 'Allows you to see the member profile of people who are applying to the body you got this permission from.'
        },
        {
            scope: 'local',
            object: 'spm',
            action: 'approve_members',
            description: ' Approve members for SPM and put board comments for boardies'
        }
    ], { individualHooks: true, validate: true });

    permissions.board = [...permissions.members, ...boardPermissions];

    const adminPermissions = await Permission.bulkCreate([
        {
            action: 'access',
            object: 'admin',
            scope: 'global',
            description: 'Seeing things regular users should not be able to see, for admins only.'
        },
        {
            action: 'apply',
            object: 'agora',
            scope: 'global',
            description: 'Apply to Agora/edit your application regardless if the deadline was passed or not.'
        },
        {
            action: 'approve_members',
            object: 'agora',
            scope: 'global',
            description: 'Approve members for Agora for all bodies'
        },
        {
            action: 'manage_applications',
            object: 'agora',
            scope: 'global',
            description: 'Manage Agora applications'
        },
        {
            action: 'manage_candidates',
            object: 'agora',
            scope: 'global',
            description: 'Manage positions and candidatures for Agora'
        },
        {
            action: 'manage_event',
            object: 'agora',
            scope: 'global',
            description: 'Creating, updating and deleting Agorae. Should be assigned to Chair and to Superadmins. '
        },
        {
            action: 'manage_incoming',
            object: 'agora',
            scope: 'global',
            description: 'Manage incoming info for Agora applications'
        },
        {
            action: 'manage_plenaries',
            object: 'agora',
            scope: 'global',
            description: 'Create, edit and see plenaries for Agora'
        },
        {
            action: 'manage_question_lines',
            object: 'agora',
            scope: 'global',
            description: 'Manage question lines and edit/delete questions for Agora'
        },
        {
            action: 'see_memberslists',
            object: 'agora',
            scope: 'global',
            description: 'See all memberslists for Agora'
        },
        {
            action: 'set_memberslists_fee_paid',
            object: 'agora',
            scope: 'global',
            description: 'This permission is to allow setting paid membership fee before the Agora'
        },
        {
            action: 'update_memberslist_status',
            object: 'agora',
            scope: 'global',
            description: 'Update the is_on_memberslist status for applications for Agora. Should be assigned to Network Director.'
        },
        {
            action: 'use_massmailer',
            object: 'agora',
            scope: 'global',
            description: 'Use massmailer for Agora.'
        },
        {
            action: 'administer',
            object: 'alastair',
            scope: 'global',
            description: 'Have full access to all alastair functions, including editing ingredients, other peoples recipes, etc'
        },
        {
            action: 'use',
            object: 'alastair',
            scope: 'global',
            description: 'Being able to use alastair to do menu planning'
        },
        {
            action: 'create',
            object: 'body',
            scope: 'global',
            description: 'Create new bodies.'
        },
        {
            action: 'delete',
            object: 'body',
            scope: 'global',
            description: 'Delete a body.'
        },
        {
            action: 'delete_member',
            object: 'body',
            scope: 'global',
            description: 'Delete the membership status of any member in any body. Use the local permission for this if possible'
        },
        {
            action: 'update',
            object: 'body',
            scope: 'global',
            description: 'Update any body, even those that you are not member of. Try to use the local permission instead'
        },
        {
            action: 'update_member',
            object: 'body',
            scope: 'global',
            description: 'Change the data attached to a body membership in any body in the system'
        },
        {
            action: 'add_member',
            object: 'body',
            scope: 'global',
            description: 'Add member to any body'
        },
        {
            action: 'view',
            object: 'body',
            scope: 'global',
            description: 'View body details, excluding the members list'
        },
        {
            action: 'view_members',
            object: 'body',
            scope: 'global',
            description: 'View the members of any body in the system. Be careful with assigning this permission as it means basically disclosing the complete members list to persons holding it'
        },
        {
            action: 'create',
            object: 'bound_circle',
            scope: 'global',
            description: 'Creating bound circles in any body of the system, even those you are not member in'
        },
        {
            action: 'put_parent',
            object: 'bound_circle',
            scope: 'local',
            description: 'Assign a parent to a bound circle. This only allows to assign parents that are in the same body as the circle to migitate permission escalations where someone with this permission could assign his own circle to one with a lot of permissions'
        },
        {
            action: 'create',
            object: 'campaign',
            scope: 'global',
            description: 'Create recruitment campaigns through which users can sign into the system.'
        },
        {
            action: 'delete',
            object: 'campaign',
            scope: 'global',
            description: 'Delete a recruitment campaign'
        },
        {
            action: 'update',
            object: 'campaign',
            scope: 'global',
            description: 'Edit recruitment campaigns'
        },
        {
            action: 'view',
            object: 'campaign',
            scope: 'global',
            description: 'View all campaigns in the system, no matter if active or not.'
        },
        {
            action: 'add_member',
            object: 'circle',
            scope: 'global',
            description: 'Add anyone to any circle in the system, no matter if the circle is joinable or not but still respecting that bound circles can only hold members of the same body. This also allows to add yourself to any circle and thus can be used for a privilege escalation'
        },
        {
            action: 'delete',
            object: 'circle',
            scope: 'global',
            description: 'Delete any circle, even those that you are not in a circle_admin position in. Should only be assigned in case of an abandoned toplevel circle as circle_admins automatically get this permission'
        },
        {
            action: 'delete_members',
            object: 'circle',
            scope: 'global',
            description: 'Delete any member from any free circle, even those that you are not in a circle_admin position in or even have member status. Should never be assigned as circle_admins automatically get this permission'
        },
        {
            action: 'join',
            object: 'circle',
            scope: 'local',
            description: 'Allows you to join joinable circles in the body where you got the permission from'
        },
        {
            action: 'put_child',
            object: 'circle',
            scope: 'global',
            description: 'Add any orphan circle in the system as a child to any circle you are circle admin in.'
        },
        {
            action: 'put_parent',
            object: 'circle',
            scope: 'global',
            description: 'Assign a parent to any circle. This permission should be granted only to trustworthy persons as it is possible to assign an own circle as child to a parent circle with a lot of permissions'
        },
        {
            action: 'put_permissions',
            object: 'circle',
            scope: 'global',
            description: 'Assign permission to any circle. This is effectively superadmin permission, as a user holding this can assign all permissions in the system to a circle where he is member in'
        },
        {
            action: 'update',
            object: 'circle',
            scope: 'global',
            description: 'Update any circle, even those that you are not in a circle_admin position in. Should only be assigned in case of an abandoned toplevel circle as circle_admins automatically get this permission'
        },
        {
            action: 'update_members',
            object: 'circle',
            scope: 'global',
            description: 'Update membership details of members of any circle, even those that you are not in a circle_admin position in or even have member status. Should never be assigned as circle_admins automatically get this permission'
        },
        {
            action: 'view',
            object: 'circle',
            scope: 'global',
            description: 'List and view the details of any circle, excluding members data'
        },
        {
            action: 'view_members',
            object: 'circle',
            scope: 'global',
            description: 'View members of any circle, even those you are not member of. Should only be given to very trusted people as this way big portions of the members database can be accessed directly'
        },
        {
            action: 'approve_event',
            object: 'conference',
            scope: 'global',
            description: 'Approve/publish conference events.'
        },
        {
            action: 'manage_event',
            object: 'conference',
            scope: 'global',
            description: 'Edit conference events.'
        },
        {
            action: 'approve_event',
            object: 'cultural',
            scope: 'global',
            description: 'Approve cultural events.'
        },
        {
            action: 'manage_event',
            object: 'cultural',
            scope: 'global',
            description: 'Edit cultural events.'
        },
        {
            action: 'manage',
            object: 'discounts',
            scope: 'global',
            description: 'Manage discounts integrations in the system'
        },
        {
            action: 'apply',
            object: 'epm',
            scope: 'global',
            description: 'Apply to EPM regardless of the deadline.'
        },
        {
            action: 'approve_members',
            object: 'epm',
            scope: 'global',
            description: 'Approve EPM members'
        },
        {
            action: 'manage_applications',
            object: 'epm',
            scope: 'global',
            description: 'Manage applications for EPM. Should be useful for CD.'
        },
        {
            action: 'manage_event',
            object: 'epm',
            scope: 'global',
            description: 'Creating, updating and deleting EPMs. Should be assigned to CD and to Superadmins.'
        },
        {
            action: 'manage_incoming',
            object: 'epm',
            scope: 'global',
            description: 'Manage attendance and paid fee statuses for EPM'
        },
        {
            action: 'manage_question_lines',
            object: 'epm',
            scope: 'global',
            description: 'Manage question lines for EPM.'
        },
        {
            action: 'see_applications',
            object: 'epm',
            scope: 'global',
            description: 'See all applications for EPM'
        },
        {
            action: 'see_memberslists',
            object: 'epm',
            scope: 'global',
            description: 'See all memberslists for EPM>'
        },
        {
            action: 'use_massmailer',
            object: 'epm',
            scope: 'global',
            description: 'Use massmailer for EPM'
        },
        {
            action: 'create',
            object: 'free_circle',
            scope: 'global',
            description: 'Create free circles'
        },
        {
            action: 'create',
            object: 'join_request',
            scope: 'global',
            description: 'Allows users to request joining a body. Without these permissions the joining body process would be disabled'
        },
        {
            action: 'process',
            object: 'join_request',
            scope: 'global',
            description: 'Process join requests in any body of the system, even those that you are not affiliated with.'
        },
        {
            action: 'view',
            object: 'join_request',
            scope: 'global',
            description: 'View join requests to any body in the system. This could disclose a bigger portion of the members database and thus should be assigned carefully'
        },
        {
            action: 'manage_event',
            object: 'ltc',
            scope: 'global',
            description: ' Manage and delete LTCs. '
        },
        {
            action: 'create',
            object: 'member',
            scope: 'global',
            description: 'Create members to any body of the system, even those you are not member or board in'
        },
        {
            action: 'update',
            object: 'member',
            scope: 'global',
            description: "Update any member in the system. Don't assign this as any member can update his own profile anyways."
        },
        {
            action: 'update',
            object: 'member',
            scope: 'local',
            description: "Update any member in the body you got this permission from. Notice that member information is global and several bodies might have the permission to access the same member. Also don't assign it when not necessary, the member can update his own profile anyways."
        },
        {
            action: 'view',
            object: 'member',
            scope: 'global',
            description: 'View all members in the system. Assign this role to trusted persons only to avoid disclosure. For local scope, use view_members:body'
        },
        {
            action: 'approve_event',
            object: 'nwm',
            scope: 'global',
            description: 'Approve and publish NWMs'
        },
        {
            action: 'manage_event',
            object: 'nwm',
            scope: 'global',
            description: 'Manage and delete NWMs'
        },
        {
            action: 'view',
            object: 'payment',
            scope: 'global',
            description: 'View payments for bodies globally.'
        },
        {
            action: 'create',
            object: 'permission',
            scope: 'global',
            description: "Create new permission objects which haven't been in the system yet, usually only good for microservices"
        },
        {
            action: 'delete',
            object: 'permission',
            scope: 'global',
            description: 'Delete a permission, should generally happen very rarely as it could break the system'
        },
        {
            action: 'update',
            object: 'permission',
            scope: 'global',
            description: 'Change permissions, should generally happen very rarely as it could break the system'
        },
        {
            action: 'view',
            object: 'permission',
            scope: 'global',
            description: 'View permissions available in the system'
        },
        {
            action: 'apply',
            object: 'spm',
            scope: 'global',
            description: 'For those who missed the SPM deadline but still need to apply'
        },
        {
            action: 'approve_members',
            object: 'spm',
            scope: 'global',
            description: 'Approve members for SPM and put board comments'
        },
        {
            action: 'manage_applications',
            object: 'spm',
            scope: 'global',
            description: 'See, accept/reject and modify in any way SPM applications.'
        },
        {
            action: 'manage_event',
            object: 'spm',
            scope: 'global',
            description: 'Create, edit and publish Statutory Planning Meeting events.'
        },
        {
            action: 'use_massmailer',
            object: 'spm',
            scope: 'global',
            description: 'Use massmailer for SPM events'
        },
        {
            action: 'see_background_tasks',
            object: 'statutory',
            scope: 'global',
            description: 'See background tasks for debugging/maintenance for statutory module.'
        },
        {
            action: 'level2_access',
            object: 'su_module',
            scope: 'global',
            description: 'Gives you board functions in the SU module for any body'
        },
        {
            action: 'level3_access',
            object: 'su_module',
            scope: 'global',
            description: 'Gives you admin access in the SU module'
        },
        {
            action: 'approve_event',
            object: 'training',
            scope: 'global',
            description: 'Approve/publish training events.'
        },
        {
            action: 'manage_event',
            object: 'training',
            scope: 'global',
            description: 'Manage training events.'
        },
        {
            action: 'delete',
            object: 'user',
            scope: 'global',
            description: 'Remove an account from the system. Don\'t assign this as any member can delete his own account anyways.'
        },
        {
            action: 'delete',
            object: 'user',
            scope: 'local',
            description: 'Delete any member in your body from the system. This allows to also delete members that are in other bodies and have a quarrel in that one body with the board admin, so be careful in granting this permission. The member can delete his own profile anyways'
        },
        {
            action: 'update_active',
            object: 'member',
            scope: 'global',
            description: 'Allows to suspend or activate any user in the system'
        },
        {
            action: 'update_active',
            object: 'member',
            scope: 'local',
            description: 'Allows to suspend or activate users that are member in the body that you got this permission from'
        },
        {
            action: 'list_unconfirmed',
            object: 'member',
            scope: 'global',
            description: 'Allows to list unconfirmed users'
        },
        {
            action: 'confirm',
            object: 'member',
            scope: 'global',
            description: 'Allows to confirm unconfirmed users manually'
        },
        {
            action: 'update_superadmin',
            object: 'member',
            scope: 'global',
            description: 'Allows to add or remove superadmin powers to any user in the system'
        }
    ], { individualHooks: true, validate: true });

    permissions.admin = [...permissions.members, ...boardPermissions, ...adminPermissions];

    for (const permission of permissions.members) {
        await CirclePermission.create({ circle_id: data.circles.membersCircle.id, permission_id: permission.id });
    }

    for (const permission of permissions.board) {
        await CirclePermission.create({ circle_id: data.circles.boardCircle.id, permission_id: permission.id });
    }

    for (const permission of permissions.admin) {
        await CirclePermission.create({ circle_id: data.circles.adminCircle.id, permission_id: permission.id });
    }

    return permissions;
}

async function createMembers() {
    const antenna = data.bodies.find((b) => b.type === 'antenna');

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
        mail_confirmed_at: new Date()
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
        mail_confirmed_at: new Date()
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
        mail_confirmed_at: new Date()
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
        mail_confirmed_at: null
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
        mail_confirmed_at: new Date()
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
        active: false
    });

    return {
        member,
        boardMember,
        notMember,
        notConfirmedMember,
        passwordResetMember,
        suspendedMember
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
