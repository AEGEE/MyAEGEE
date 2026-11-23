const generator = require('./generator');

// The permissions the routes below ask for. A superadmin holds every permission that exists.
const PERMISSIONS = [
    'create:body', 'update:body', 'delete:body', 'add_member:body', 'create_member:body', 'update_member:body',
    'create:circle', 'update:circle', 'put_parent:circle', 'put_permissions:circle', 'add_member:circle', 'update_members:circle',
    'create:permission', 'update:permission',
    'create:campaign', 'update:campaign',
    'create:payment', 'update:payment',
    'process:join_request',
    'update:member', 'update_active:user', 'update_superadmin:member', 'update_application_ban:member', 'confirm:member',
    'subscribe:listserv',
    'manage:resources'
];

// Everything the routes below need to exist: a superadmin who sends the requests, and a
// member of a body with a circle, a payment, a campaign and pending tokens of every kind.
exports.createFixtures = async () => {
    for (const permission of PERMISSIONS) {
        const [action, object] = permission.split(':');
        await generator.createPermission({ scope: 'global', action, object });
    }

    const admin = await generator.createUser({ superadmin: true, password: 'admin-password' });
    const token = await generator.createAccessToken(admin);

    const body = await generator.createBody();
    const otherBody = await generator.createBody();
    const circle = await generator.createCircle({ body_id: body.id });
    const freeCircle = await generator.createCircle();
    const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });

    const member = await generator.createUser({ password: 'member-password', email: 'member@example.com' });
    const membership = await generator.createBodyMembership(body, member);
    const circleMembership = await generator.createCircleMembership(circle, member);
    const payment = await generator.createPayment(body, member);

    const outsider = await generator.createUser();
    const applicant = await generator.createUser();
    const joinRequest = await generator.createJoinRequest(body, applicant);

    const unconfirmed = await generator.createUser({ mail_confirmed_at: null });
    const mailConfirmation = await generator.createMailConfirmation(unconfirmed);

    const campaign = await generator.createCampaign({ autojoin_body_id: body.id, active: true });
    const mailChange = await generator.createMailChange(member);
    const passwordReset = await generator.createPasswordReset(member);
    const refreshToken = await generator.createRefreshToken(member);

    const category = await generator.createResourceCategory();
    const link = await generator.createResourceLink(category);

    return {
        admin,
        token,
        body,
        otherBody,
        circle,
        freeCircle,
        permission,
        member,
        membership,
        circleMembership,
        payment,
        outsider,
        applicant,
        joinRequest,
        unconfirmed,
        mailConfirmation,
        campaign,
        mailChange,
        passwordReset,
        refreshToken,
        category,
        link
    };
};

const userFields = () => ({
    ...generator.generateUser({ date_of_birth: '1990-01-01' }),
    privacy_consent: '2020-01-01T00:00:00.000Z'
});

const bodyFields = () => ({
    ...generator.generateBody({ founded_at: '2000-01-01' }),
    task_description: 'Tasks',
    abbreviation: 'ABBR',
    postal_address: 'Street 1',
    type: 'antenna',
    fee_currency: 'EUR',
    pays_fees: true,
    country: 'Netherlands',
    website: 'https://example.com',
    gsuite_id: 'body@aegee.eu',
    google_group: 'group@aegee.eu'
});

const campaignFields = () => ({
    ...generator.generateCampaign(),
    active: true,
    activate_user: true
});

const paymentFields = () => ({
    starts: '2020-01-01',
    expires: '2030-01-01',
    amount: 10,
    currency: 'EUR',
    comment: 'Comment',
    invoice_name: 'Name',
    invoice_address: 'Address'
});

// Every route that reads a JSON request body, with a body it accepts.
// `noBody` is the status it answers when the request has no body at all.
// `multipart`: the route takes a form with files, so there are no JSON fields to vary.
// `noFields`: the route reads nothing from the body.
exports.ROUTES = [
    { method: 'POST', name: '/signup/:campaign_id', path: (d) => `/signup/${d.campaign.url}`, body: () => userFields(), noBody: 422 },
    { method: 'POST', name: '/confirm-email', path: () => '/confirm-email', body: (d) => ({ token: d.mailConfirmation.value }), noBody: 400 },
    { method: 'POST', name: '/confirm-email-change', path: () => '/confirm-email-change', body: (d) => ({ token: d.mailChange.value }), noBody: 404 },
    { method: 'POST', name: '/login', path: () => '/login', body: (d) => ({ username: d.member.email, password: 'member-password' }), noBody: 403 },
    { method: 'POST', name: '/logout', path: () => '/logout', body: (d) => ({ refresh_token: d.refreshToken.value }), noBody: 400 },
    { method: 'POST', name: '/password_reset', path: () => '/password_reset', body: (d) => ({ email: d.member.email }), noBody: 200 },
    { method: 'POST', name: '/password_confirm', path: () => '/password_confirm', body: (d) => ({ token: d.passwordReset.value, password: 'a-new-password' }), noBody: 404 },
    { method: 'POST', name: '/renew', path: () => '/renew', body: (d) => ({ refresh_token: d.refreshToken.value }), noBody: 403 },
    { method: 'POST', name: '/bug-report', path: () => '/bug-report', multipart: true, noBody: 200 },
    { method: 'POST', name: '/my_permissions', path: () => '/my_permissions', body: () => ({ action: 'process', object: 'join_request' }), noBody: 400 },
    { method: 'POST', name: '/bodies', path: () => '/bodies', body: () => bodyFields(), noBody: 422 },
    { method: 'POST', name: '/circles', path: () => '/circles', body: () => ({ name: 'Circle', description: 'Description' }), noBody: 422 },
    {
        method: 'POST',
        name: '/permissions',
        path: () => '/permissions',
        body: () => ({ scope: 'global', action: 'act', object: 'thing', description: 'Description', filters: ['name'] }),
        noBody: 422
    },
    { method: 'POST', name: '/campaigns', path: () => '/campaigns', body: (d) => ({ ...campaignFields(), autojoin_body_id: d.body.id }), noBody: 422 },
    { method: 'POST', name: '/resources/categories', path: () => '/resources/categories', body: () => ({ name: 'Section', theme: 'blue' }), noBody: 422 },
    {
        method: 'POST',
        name: '/resources/links',
        path: () => '/resources/links',
        body: (d) => ({ category_id: d.category.id, title: 'Title', description: 'Description', url: 'https://example.com' }),
        noBody: 422
    },
    { method: 'PUT', name: '/resources/categories/order', path: () => '/resources/categories/order', body: (d) => ({ ids: [d.category.id] }), noBody: 422 },
    { method: 'PUT', name: '/members/:user_id/active', path: (d) => `/members/${d.member.id}/active`, body: () => ({ active: false }), noBody: 200 },
    {
        method: 'PUT',
        name: '/members/:user_id/event-application-ban',
        path: (d) => `/members/${d.member.id}/event-application-ban`,
        body: () => ({ ban_until: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString() }),
        noBody: 422
    },
    { method: 'PUT', name: '/members/:user_id/superadmin', path: (d) => `/members/${d.member.id}/superadmin`, body: () => ({ superadmin: true }), noBody: 200 },
    { method: 'POST', name: '/members/:user_id/confirm', path: (d) => `/members/${d.unconfirmed.id}/confirm`, body: () => ({}), noFields: true, noBody: 200 },
    { method: 'PUT', name: '/members/:user_id/primary-body', path: (d) => `/members/${d.member.id}/primary-body`, body: (d) => ({ primary_body_id: d.body.id }), noBody: 200 },
    { method: 'PUT', name: '/members/:user_id/email', path: (d) => `/members/${d.member.id}/email`, body: () => ({ new_email: 'new@example.com' }), noBody: 400 },
    {
        method: 'PUT',
        name: '/members/:user_id/password',
        path: (d) => `/members/${d.member.id}/password`,
        body: () => ({ old_password: 'member-password', password: 'a-new-password' }),
        noBody: 422
    },
    { method: 'POST', name: '/members/:user_id/listserv', path: (d) => `/members/${d.member.id}/listserv`, body: () => ({ mailinglists: ['ANNOUNCE-L'] }), noBody: 400 },
    {
        method: 'PUT',
        name: '/members/:user_id',
        path: (d) => `/members/${d.member.id}`,
        body: () => {
            const { email, password, mail_confirmed_at: confirmed, ...fields } = userFields();
            return { ...fields, gsuite_id: 'member@aegee.eu', primary_email: 'gsuite' };
        },
        noBody: 200
    },
    { method: 'POST', name: '/members/:user_id/upload', path: (d) => `/members/${d.member.id}/upload`, multipart: true, noBody: 422 },
    { method: 'POST', name: '/bodies/:body_id/campaigns', path: (d) => `/bodies/${d.body.id}/campaigns`, body: () => campaignFields(), noBody: 422 },
    { method: 'POST', name: '/bodies/:body_id/circles', path: (d) => `/bodies/${d.body.id}/circles`, body: () => ({ name: 'Circle', description: 'Description' }), noBody: 422 },
    { method: 'POST', name: '/bodies/:body_id/members', path: (d) => `/bodies/${d.body.id}/members`, body: (d) => ({ user_id: d.outsider.id }), noBody: 400 },
    { method: 'POST', name: '/bodies/:body_id/create-member', path: (d) => `/bodies/${d.body.id}/create-member`, body: () => userFields(), noBody: 422 },
    { method: 'POST', name: '/bodies/:body_id/join-requests', path: (d) => `/bodies/${d.otherBody.id}/join-requests`, body: () => ({ motivation: 'Motivation' }), noBody: 200 },
    {
        method: 'POST',
        name: '/bodies/:body_id/payments',
        path: (d) => `/bodies/${d.body.id}/payments`,
        body: (d) => ({ user_id: d.member.id, ...paymentFields() }),
        noBody: 400
    },
    { method: 'PUT', name: '/bodies/:body_id/status', path: (d) => `/bodies/${d.otherBody.id}/status`, body: () => ({ status: 'deleted' }), noBody: 200 },
    {
        method: 'PUT',
        name: '/bodies/:body_id',
        path: (d) => `/bodies/${d.body.id}`,
        body: (d) => ({ ...bodyFields(), shadow_circle_id: d.circle.id }),
        noBody: 200
    },
    {
        method: 'PUT',
        name: '/bodies/:body_id/members/:membership_id',
        path: (d) => `/bodies/${d.body.id}/members/${d.membership.id}`,
        body: () => ({ comment: 'Comment' }),
        noBody: 200
    },
    {
        method: 'PUT',
        name: '/bodies/:body_id/join-requests/:request_id/status',
        path: (d) => `/bodies/${d.body.id}/join-requests/${d.joinRequest.id}/status`,
        body: () => ({ status: 'approved' }),
        noBody: 400
    },
    {
        method: 'PUT',
        name: '/bodies/:body_id/campaigns/:campaign_id',
        path: (d) => `/bodies/${d.body.id}/campaigns/${d.campaign.id}`,
        body: () => campaignFields(),
        noBody: 200
    },
    {
        method: 'PUT',
        name: '/bodies/:body_id/payments/:payment_id',
        path: (d) => `/bodies/${d.body.id}/payments/${d.payment.id}`,
        body: () => paymentFields(),
        noBody: 200
    },
    { method: 'POST', name: '/circles/:circle_id/permissions', path: (d) => `/circles/${d.circle.id}/permissions`, body: (d) => ({ permission_id: d.permission.id }), noBody: 400 },
    { method: 'PUT', name: '/circles/:circle_id/parent', path: (d) => `/circles/${d.circle.id}/parent`, body: (d) => ({ parent_circle_id: d.freeCircle.id }), noBody: 400 },
    { method: 'POST', name: '/circles/:circle_id/members', path: (d) => `/circles/${d.freeCircle.id}/members`, body: (d) => ({ user_id: d.outsider.id }), noBody: 400 },
    {
        method: 'PUT',
        name: '/circles/:circle_id',
        path: (d) => `/circles/${d.circle.id}`,
        body: () => ({ name: 'Circle', description: 'Description', gsuite_id: 'circle@aegee.eu' }),
        noBody: 200
    },
    {
        method: 'PUT',
        name: '/circles/:circle_id/members/:membership_id',
        path: (d) => `/circles/${d.circle.id}/members/${d.circleMembership.id}`,
        body: () => ({ position: 'Position' }),
        noBody: 200
    },
    {
        method: 'PUT',
        name: '/permissions/:permission_id',
        path: (d) => `/permissions/${d.permission.id}`,
        body: () => ({ scope: 'local', action: 'act', object: 'thing', description: 'Description', filters: ['name'] }),
        noBody: 200
    },
    { method: 'PUT', name: '/campaigns/:campaign_id', path: (d) => `/campaigns/${d.campaign.id}`, body: (d) => ({ ...campaignFields(), autojoin_body_id: d.otherBody.id }), noBody: 200 },
    { method: 'PUT', name: '/resources/categories/:category_id', path: (d) => `/resources/categories/${d.category.id}`, body: () => ({ name: 'Section', theme: 'red' }), noBody: 200 },
    {
        method: 'PUT',
        name: '/resources/categories/:category_id/links/order',
        path: (d) => `/resources/categories/${d.category.id}/links/order`,
        body: (d) => ({ ids: [d.link.id] }),
        noBody: 422
    },
    {
        method: 'PUT',
        name: '/resources/links/:link_id',
        path: (d) => `/resources/links/${d.link.id}`,
        body: (d) => ({ category_id: d.category.id, title: 'Title', description: 'Description', url: 'https://example.com' }),
        noBody: 200
    }
].map((route) => ({ ...route, title: `${route.method} ${route.name}` }));
