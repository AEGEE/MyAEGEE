const path = require('path');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { sequelize } = require('../../lib/sequelize');
const { ROUTES, createFixtures } = require('./body-routes');

// The table that the sweeps over all routes are driven by: every operation of openapi.yaml,
// so a new route gets its rows without anyone writing them, with a path and a body it accepts.
const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });

// '/members/{user_id}' in the spec is '/members/:user_id' in the table of routes with a body.
const toRouteName = (template) => template.replace(/\{(\w+)\}/g, ':$1');

exports.OPERATIONS = listOperations(spec).map((operation) => {
    const route = ROUTES.find((item) => item.method === operation.method && item.name === toRouteName(operation.template));

    return {
        ...operation,
        title: `${operation.method} ${operation.template}`,
        // A JSON body the operation accepts, so that only what a sweep varies decides the answer.
        body: route && !route.multipart ? route.body : undefined
    };
});

exports.createFixtures = createFixtures;

// A value that exists for every parameter in a path.
const pathValues = (operation, data) => ({
    user_id: data.member.id,
    body_id: data.body.id,
    circle_id: data.circle.id,
    permission_id: data.permission.id,
    // The signup route takes the URL of a campaign, the other routes also its ID.
    campaign_id: operation.template.startsWith('/signup/') ? data.campaign.url : data.campaign.id,
    membership_id: operation.template.startsWith('/circles/') ? data.circleMembership.id : data.membership.id,
    request_id: data.joinRequest.id,
    payment_id: data.payment.id,
    category_id: data.category.id,
    link_id: data.link.id
});

// The path of an operation for the fixtures, with `overrides` for the parameters under test.
exports.buildPath = (operation, data, overrides = {}) => {
    const values = { ...pathValues(operation, data), ...overrides };
    return operation.template.replace(/\{(\w+)\}/g, (match, name) => encodeURIComponent(values[name]));
};

// Everything that is stored, to show that a refused request changed nothing.
// Without the two columns that every request with a token writes.
exports.snapshot = async () => {
    const tables = {};

    for (const model of Object.values(sequelize.models)) {
        const rows = await model.unscoped().findAll({ order: [['id', 'ASC']], raw: true });
        tables[model.getTableName()] = rows.map(({ last_active: lastActive, updated_at: updatedAt, ...row }) => row);
    }

    return tables;
};
