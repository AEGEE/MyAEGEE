const { faker } = require('@faker-js/faker');

const {
    User,
    Campaign,
    MailConfirmation,
    MailChange,
    AccessToken,
    RefreshToken,
    PasswordReset,
    Body,
    Circle,
    Permission,
    CirclePermission,
    CircleMembership,
    BodyMembership,
    JoinRequest,
    Payment
} = require('../../models');

const notSet = (field) => typeof field === 'undefined';

exports.generateUser = (options = {}) => {
    if (notSet(options.username)) options.username = faker.string.alphanumeric(16);
    if (notSet(options.first_name)) options.first_name = faker.person.firstName();
    if (notSet(options.last_name)) options.last_name = faker.person.lastName();
    if (notSet(options.email)) options.email = faker.internet.email();
    if (notSet(options.gender)) options.gender = faker.string.alphanumeric(16);
    if (notSet(options.phone)) options.phone = faker.phone.number();
    if (notSet(options.date_of_birth)) options.date_of_birth = faker.date.past();
    if (notSet(options.about_me)) options.about_me = faker.lorem.paragraph();
    if (notSet(options.address)) options.address = faker.lorem.paragraph();
    if (notSet(options.password)) options.password = faker.string.alphanumeric(16);
    if (notSet(options.mail_confirmed_at)) options.mail_confirmed_at = new Date();
    if (notSet(options.primary_email)) options.primary_email = 'personal';

    return options;
};

exports.createUser = (options = {}) => {
    return User.create(exports.generateUser(options));
};

exports.generateMailConfirmation = (user, options = {}) => {
    if (notSet(options.value)) options.value = faker.string.alphanumeric(16);
    if (notSet(options.expires_at)) options.expires_at = faker.date.future();
    if (user) options.user_id = user.id;

    return options;
};

exports.createMailConfirmation = (user = null, options = {}) => {
    return MailConfirmation.create(exports.generateMailConfirmation(user, options));
};

exports.generateBody = (options = {}) => {
    if (notSet(options.name)) options.name = faker.person.firstName();
    if (notSet(options.description)) options.description = faker.lorem.paragraph();
    if (notSet(options.code)) options.code = faker.string.alpha(3);
    if (notSet(options.email)) options.email = faker.internet.email();
    if (notSet(options.phone)) options.phone = faker.phone.number();
    if (notSet(options.address)) options.address = faker.lorem.paragraph();
    if (notSet(options.founded_at)) options.founded_at = faker.date.past();

    return options;
};

exports.createBody = (options = {}) => {
    return Body.create(exports.generateBody(options));
};

exports.generateCircle = (options = {}, circle = null) => {
    if (notSet(options.name)) options.name = faker.person.firstName();
    if (notSet(options.description)) options.description = faker.lorem.paragraph();
    if (notSet(options.joinable)) options.joinable = true;
    if (circle) options.parent_circle_id = circle.id;

    return options;
};

exports.createCircle = (options = {}, circle = null) => {
    return Circle.create(exports.generateCircle(options, circle));
};

exports.generateCampaign = (options = {}) => {
    if (notSet(options.name)) options.name = faker.string.alphanumeric(16);
    if (notSet(options.url)) options.url = faker.string.alphanumeric(16);
    if (notSet(options.description_short)) options.description_short = faker.lorem.paragraph();
    if (notSet(options.description_long)) options.description_long = faker.lorem.paragraph();

    return options;
};

exports.createCampaign = (options = {}) => {
    return Campaign.create(exports.generateCampaign(options));
};

exports.generatePermission = (options = {}) => {
    if (notSet(options.scope)) options.scope = 'global';
    if (notSet(options.action)) options.action = faker.string.alphanumeric({ length: 16, casing: 'lower' });
    if (notSet(options.object)) options.object = faker.string.alphanumeric({ length: 16, casing: 'lower' });
    if (notSet(options.description)) options.description = faker.lorem.paragraph();

    return options;
};

exports.createPermission = (options = {}) => {
    return Permission.create(exports.generatePermission(options));
};

exports.generateRefreshToken = (user, options = {}) => {
    if (notSet(options.value)) options.value = faker.string.alphanumeric(16);
    if (user) options.user_id = user.id;

    return options;
};

exports.createRefreshToken = (user = null, options = {}) => {
    return RefreshToken.create(exports.generateRefreshToken(user, options));
};

exports.generateAccessToken = (user, options = {}) => {
    if (notSet(options.value)) options.value = faker.string.alphanumeric(16);
    if (notSet(options.expires_at)) options.expires_at = faker.date.future();
    if (user) options.user_id = user.id;

    return options;
};

exports.createAccessToken = (user = null, options = {}) => {
    return AccessToken.create(exports.generateAccessToken(user, options));
};

exports.generatePasswordReset = (user, options = {}) => {
    if (notSet(options.value)) options.value = faker.string.alphanumeric(16);
    if (notSet(options.expires_at)) options.expires_at = faker.date.future();
    if (user) options.user_id = user.id;

    return options;
};

exports.createPasswordReset = (user = null, options = {}) => {
    return PasswordReset.create(exports.generatePasswordReset(user, options));
};

exports.createCircleMembership = (circle, user) => {
    return CircleMembership.create({
        circle_id: circle.id,
        user_id: user.id
    });
};

exports.createCirclePermission = (circle, permission) => {
    return CirclePermission.create({
        circle_id: circle.id,
        permission_id: permission.id
    });
};

exports.createBodyMembership = (body, user) => {
    return BodyMembership.create({
        body_id: body.id,
        user_id: user.id
    });
};

exports.createJoinRequest = (body, user) => {
    return JoinRequest.create({
        body_id: body.id,
        user_id: user.id
    });
};

exports.createPayment = (body, user, options = {}) => {
    return Payment.create(exports.generatePayment(body, user, options));
};

exports.generatePayment = (body, user, options = {}) => {
    if (body && body.id) options.body_id = body.id;
    if (user && user.id) options.user_id = user.id;

    if (notSet(options.starts)) options.starts = faker.date.past();
    if (notSet(options.expires)) options.expires = faker.date.future();
    if (notSet(options.amount)) options.amount = faker.number.int({ min: 1 });
    if (notSet(options.currency)) options.currency = faker.string.alphanumeric(3);

    return options;
};

exports.generateMailChange = (user, options = {}) => {
    if (notSet(options.value)) options.value = faker.string.alphanumeric(16);
    if (notSet(options.expires_at)) options.expires_at = faker.date.future();
    if (notSet(options.new_email)) options.new_email = faker.internet.email();
    if (user) options.user_id = user.id;

    return options;
};

exports.createMailChange = (user = null, options = {}) => {
    return MailChange.create(exports.generateMailChange(user, options));
};

exports.clearAll = async () => {
    await MailChange.destroy({ where: {}, truncate: { cascade: true } });
    await Payment.destroy({ where: {}, truncate: { cascade: true } });
    await JoinRequest.destroy({ where: {}, truncate: { cascade: true } });
    await BodyMembership.destroy({ where: {}, truncate: { cascade: true } });
    await Permission.destroy({ where: {}, truncate: { cascade: true } });
    await CirclePermission.destroy({ where: {}, truncate: { cascade: true } });
    await CircleMembership.destroy({ where: {}, truncate: { cascade: true } });
    await Circle.destroy({ where: {}, truncate: { cascade: true } });
    await Body.destroy({ where: {}, truncate: { cascade: true } });
    await AccessToken.destroy({ where: {}, truncate: { cascade: true } });
    await RefreshToken.destroy({ where: {}, truncate: { cascade: true } });
    await MailConfirmation.destroy({ where: {}, truncate: { cascade: true } });
    await User.destroy({ where: {}, truncate: { cascade: true } });
    await Campaign.destroy({ where: {}, truncate: { cascade: true } });
};
