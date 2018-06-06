exports.getPermissions = (user) => {
    const permissions = {
        is: {},
        can: {}
    };

    permissions.is.superadmin = user.user && user.user.superadmin;
    permissions.is.chair_team = user.bodies.some(body => body.name.includes('Chair Team'));
    permissions.is.jc = user.bodies.some(body => body.name.includes('Juridical Commission'));

    permission.is.member_of = {};
    permission.is.board_member_of = {};

    for (const body of user.bodies) {
        permission.is.member_of[body.id] = true;
        permission.is.board_member_of[body.id] = user.circles.some(c => c.body_id === body.id && c.name.toLowerCase.includes('board'));
    }

    return permissions;
};