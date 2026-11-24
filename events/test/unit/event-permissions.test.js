const helpers = require('../../lib/helpers');

// A member of body 9; the event is a network meeting organized by user 1 unless the role is organizer.
const user = { id: 5, bodies: [{ id: 9 }] };
const GRANTS = {
    member: [],
    organizer: [],
    approver: ['global:approve_event:nwm'],
    manager: ['global:manage_event:nwm']
};

const permissionsFor = (role, eventFields) => {
    const event = {
        type: 'nwm',
        deleted: false,
        application_status: 'closed',
        organizers: [{ user_id: role === 'organizer' ? user.id : 1 }],
        ...eventFields
    };
    const permissions = helpers.getPermissions(user, GRANTS[role].map((combined) => ({ combined })), []);
    return helpers.getEventPermissions({ permissions, event, user });
};

describe('getEventPermissions', () => {
    const none = { draft: false, submitted: false, published: false };

    test.each([
        // role, status, see_event, edit_event, change_status
        ['member', 'draft', false, false, none],
        ['member', 'submitted', false, false, none],
        ['member', 'published', true, false, none],
        ['organizer', 'draft', true, true, { ...none, submitted: true }],
        ['organizer', 'submitted', true, false, none],
        ['organizer', 'published', true, false, none],
        ['approver', 'draft', true, false, { ...none, submitted: true }],
        ['approver', 'submitted', true, false, { draft: true, submitted: false, published: true }],
        ['approver', 'published', true, false, { ...none, submitted: true }],
        // Managers may edit and delete, but only see drafts if they may also approve them.
        ['manager', 'draft', false, true, none],
        ['manager', 'submitted', false, true, none],
        ['manager', 'published', true, true, none],
    ])('%s, %s event: see %p, edit %p', (role, status, seeEvent, editEvent, changeStatus) => {
        const permissions = permissionsFor(role, { status });

        expect(permissions.see_event).toEqual(seeEvent);
        expect(permissions.edit_event).toEqual(editEvent);
        expect(permissions.change_status).toEqual(changeStatus);
        expect(permissions.delete_event).toEqual(role === 'manager');
        expect(permissions.list_applications).toEqual(['organizer', 'manager'].includes(role));
    });

    test('a deleted published event is hidden from members, not from its organizers', () => {
        expect(permissionsFor('member', { status: 'published', deleted: true }).see_event).toEqual(false);
        expect(permissionsFor('organizer', { status: 'published', deleted: true }).see_event).toEqual(true);
    });

    test.each([
        ['published', 'open', true],
        ['published', 'closed', false],
        ['submitted', 'open', false],
        ['draft', 'open', false],
    ])('apply on a %s event with a %s application period: %p', (status, applicationStatus, apply) => {
        expect(permissionsFor('member', { status, application_status: applicationStatus }).apply).toEqual(apply);
    });
});

describe('getApplicationPermissions', () => {
    const forApplication = (role, eventFields, applicantId) => helpers.getApplicationPermissions({
        permissions: permissionsFor(role, eventFields),
        application: { user_id: applicantId },
        user
    });

    test.each([
        // who, event, applicant, view_application, edit_application
        ['member', { status: 'published', application_status: 'open' }, user.id, true, true],
        ['member', { status: 'published', application_status: 'closed' }, user.id, true, false],
        ['member', { status: 'published', application_status: 'open' }, 1, false, false],
        ['organizer', { status: 'draft' }, 1, true, true],
        ['organizer', { status: 'published' }, 1, true, false],
        ['manager', { status: 'published' }, 1, true, true],
    ])('%s, %p, applicant %p: view %p, edit %p', (role, eventFields, applicantId, view, edit) => {
        const permissions = forApplication(role, eventFields, applicantId);

        expect(permissions.view_application).toEqual(view);
        expect(permissions.edit_application).toEqual(edit);
    });
});
