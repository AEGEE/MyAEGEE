module.exports = {
    up: (queryInterface) => queryInterface.sequelize.query(`
        insert into permissions (scope, action, object, combined, description, filters, created_at, updated_at)
        values
            ('global', 'approve_event', 'thematic', 'global:approve_event:thematic', 'Approve thematic events.', '{}', now(), now()),
            ('global', 'manage_event', 'thematic', 'global:manage_event:thematic', 'Edit thematic events.', '{}', now(), now())
        on conflict (scope, action, object) do nothing;
    `),
    down: (queryInterface) => queryInterface.sequelize.query(`
        delete from permissions
        where scope = 'global'
            and object = 'thematic'
            and action in ('approve_event', 'manage_event');
    `)
};
