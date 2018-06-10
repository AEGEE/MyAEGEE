/* A helper for setting every property of object to 'true' recursively. */
function setTrue(object) {
    for (const key in object) {
        if (typeof object[key] === 'object') {
            setTrue(object[key]);
        } else {
            object[key] = true;
        }
    }
}

exports.getPermissions = (user) => {
    const permissions = {
        is: {},
        can: {}
    };

    permissions.is.superadmin = user.user && user.user.superadmin;
    permissions.is.chair_team = user.bodies.some(body => body.name.includes('Chair Team'));
    permissions.is.jc = user.bodies.some(body => body.name.includes('Juridical Commission'));
    permissions.is.cd = user.bodies.some(body => body.name.includes('Comite Directeur'));

    permissions.is.member_of = {};
    permissions.is.board_member_of = {};

    for (const body of user.bodies) {
        permissions.is.member_of[body.id] = true;
        permissions.is.board_member_of[body.id] = user.circles.some(c => c.body_id === body.id && c.name.toLowerCase().includes('board'));
    }

    permissions.can.create_events = { agora: permissions.is.chair_team, epm: permissions.is.chair_team };
    permissions.can.edit_events = { agora: permissions.is.chair_team, epm: permissions.is.chair_team };
    permissions.can.edit_organizers = { agora: permissions.is.chair_team, epm: permissions.is.chair_team };
    permissions.can.edit_bodies = { agora: permissions.is.chair_team, epm: permissions.is.chair_team };
    permissions.can.delete_events = { agora: permissions.is.chair_team, epm: permissions.is.chair_team };

    permissions.can.set_participants_status = { agora: permissions.is.chair_team, epm: permissions.is.chair_team };

    if (permissions.is.superadmin) {
        setTrue(permissions.can);
    }

    return permissions;
};
