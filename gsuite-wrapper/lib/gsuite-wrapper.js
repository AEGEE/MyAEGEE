const { runGsuiteOperation, gsuiteOperations } = require('./google-suite');

const log = require('./util/logger');
const config = require('./config/configFile');
const redis = require('./redis').db;

// API DEFINITION

/**
 * @swagger
 *
 * tags:
 *   - name: "Account"
 *     description: "Accounts operations: add/remove user; modify user details; add/remove aliases for user email"
 *     externalDocs:
 *       description: "The user will have to accept Gsuite terms"
 *       url: "https://my.aegee.eu"
 *   - name: "Groups"
 *     description: "Groups operations: add/remove a google group; add/remove a user membership to a group"
 *     externalDocs:
 *       description: "The user will be subscribed and unsubscribed automatically most of the times"
 *       url: "http://groups.aegee.eu"
 *   - name: "Calendar"
 *     description: "Calendar operations: add an event to the Gsuite calendar of events"
 *     externalDocs:
 *       description: "The user will be subscribed and unsubscribed automatically most of the times"
 *       url: "http://calendar.aegee.eu"
 *
 * definitions:
 *   generalResponse:
 *     type: object
 *     required:
 *       - success
 *       - message
 *     properties:
 *       success:
 *         type: boolean
 *       message:
 *         type: string
 *
 *   errorResponse:
 *     allOf:
 *       - '$ref': '#/definitions/generalResponse'
 *       - type: object
 *         required:
 *           - error
 *         properties:
 *           error:
 *             type: string
 *
 *
 *   successResponse:
 *     allOf:
 *       - '$ref': '#/definitions/generalResponse'
 *       - type: object
 *         required:
 *           - data
 *         properties:
 *           data:
 *             type: object
 *             example:
 *               "<property>": "<the whole object has all the properties being the name of the db fields>"
 *
 *   Group:
 *     type: "object"
 *     properties:
 *       primaryEmail:
 *         type: "string"
 *         description: "The google ID (xxx@aegee.eu) of the group that is added"
 *         format: "email"
 *       groupName:
 *         type: "string"
 *         description: "The name of the Google group"
 *         format: "string"
 *       bodyPK:
 *         type: "string"
 *         description: "The primary key that identifies the body/circle in MyAEGEE"
 *         format: "string"
 *     required:
 *       - groupName
 *       - primaryEmail
 *       - bodyPK
 *     example:
 *       groupName: "The Straight Banana Committee"
 *       primaryEmail: "sbc@aegee.eu"
 *       bodyPK: "(idk how it's represented)"
 *
 *   Account:
 *     type: "object"
 *     properties:
 *       primaryEmail:
 *         type: "string"
 *         description: "The username @aegee.eu for the account"
 *         format: "string"
 *       name:
 *         $ref: "#/definitions/Account_name"
 *       secondaryEmail:
 *         type: "string"
 *         description: "The email of the user. For password reset and first-time sign up"
 *         format: "email"
 *       password:
 *         type: "string"
 *         description: "MUST be a SHA-1 password"
 *         format: "password"
 *       antenna:
 *         type: "string"
 *         description: "The (primary) antenna the user belongs to"
 *         format: "string"
 *       userPK:
 *         type: "string"
 *         description: "The primary key of the user in MyAEGEE"
 *     required:
 *       - primaryEmail
 *       - name
 *       - secondaryEmail
 *       - password
 *       - antenna
 *       - userPK
 *     example:
 *       primaryEmail: "cave.johnson@aegee.eu"
 *       name:
 *         givenName: "Cave"
 *         familyName: "Johnson"
 *       secondaryEmail: "cave.aegee@example.com"
 *       password: "[SOME-SHA1-HASH]"
 *       antenna: "AEGEE-Tallahassee"
 *       userPK: "(idk how it's represented)"
 *
 *   Account_name:
 *     properties:
 *       givenName:
 *         type: "string"
 *       familyName:
 *         type: "string"
 *     required:
 *       - givenName
 *       - familyName
 *     example:
 *       givenName: "Cave"
 *       familyName: "Johnson"
 *
 *   Membership:
 *     type: "object"
 *     properties:
 *       groupPK:
 *         type: "string"
 *         description: "(required) The group in which the user \
 *                       is added. MyAEGEE's PK of the body/circle"
 *       operation:
 *         type: "string"
 *         description: "(required) 'add'/'remove' member"
 *     required:
 *       - groupPK
 *       - operation
 *     example:
 *       groupPK: "(idk how it's represented)"
 *       operation: "add"
 *
 *   aliasOperation:
 *     type: "object"
 *     properties:
 *       aliasName:
 *         type: "string"
 *         description: "The alias that is added"
 *       operation:
 *         type: "string"
 *         description: "'add'/'remove' alias"
 *     required:
 *       - aliasName
 *       - operation
 *     example:
 *       aliasName: "example@aegee.eu"
 *       operation: "add"
 *
 *   Event:
 *     properties:
 *       name:
 *         type: "string"
 *         description: "The name of the event"
 *       startDate:
 *         type: "string"
 *         description: "Format MUST be YYYY-MM-DD"
 *       endDate:
 *         type: "string"
 *         description: "Format MUST be YYYY-MM-DD"
 *       description:
 *         type: "string"
 *         description: "The description of the event"
 *       location:
 *         type: "string"
 *         description: "The city where the event is happening. Can be any string"
 *       eventID:
 *         type: "string"
 *         description: "Format MUST be a-v 0-9"
 *     description: "(required)"
 *     required:
 *       - name
 *       - startDate
 *       - endDate
 *       - description
 *       - location
 *       - eventID
 *     example:
 *       name: "RTC Tallahassee"
 *       startDate: "2019-04-25"
 *       endDate: "2019-04-25"
 *       description: "An RTC in a far away place"
 *       location: "Tallahassee, Florida"
 *       eventID: "rtctallahassee19"
 */
// ////////////////////////////////////////////////////////////
/**
 * @swagger
 *
 * /group:
 *   post:
 *     tags:
 *       - "Groups"
 *     summary: "Create Gsuite group"
 *     description: "This endpoint is to create a Gsuite group"
 *     operationId: "createGroup"
 *     consumes:
 *       - "application/json"
 *     produces:
 *       - "application/json"
 *     parameters:
 *       - name: "data"
 *         in: "body"
 *         description: "The data containing information on the group"
 *         required: true
 *         schema:
 *           $ref: '#/definitions/Group'
 *     responses:
 *       201:
 *         description: "Successful operation"
 *       400:
 *         description: "Invalid input"
 *       409:
 *         description: "Duplicate entity"
 */

exports.createGroup = async function (req, res, next) {
    log.debug(req.headers['test-title']);

    const data = req.body;

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;

    if (!data.groupName || !data.primaryEmail || !data.bodyPK) {
        response.message = 'Validation error: primaryEmail, groupName, or bodyPK is absent or empty';
        statusCode = 400;
    } else {
        try {
            const result = await runGsuiteOperation(gsuiteOperations.addGroup, data);
            response = { success: result.success, message: result.data.email + ' group has been created', data: result.data };
            statusCode = result.code;

            redis.hset('group:' + data.bodyPK, 'GsuiteAccount', data.primaryEmail);
            redis.set('primary:' + data.bodyPK, data.primaryEmail);
            redis.set('id:' + data.primaryEmail, data.bodyPK);
        } catch (GsuiteError) {
            log.warn('GsuiteError');
            response = { success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }
    }

    return res.status(statusCode).json(response);
};

/**
 * @swagger
 *
 * /group/{bodyPK}:
 *   delete:
 *     tags:
 *       - "Groups"
 *     summary: "Delete Gsuite group"
 *     description: "This endpoint is to delete the Gsuite group. 'bodyPK' refers to the primary key of the body/circle in the system."
 *     operationId: "deleteGroup"
 *     produces:
 *       - "application/json"
 *     parameters:
 *       - name: "bodyPK"
 *         in: "path"
 *         description: "The MyAEGEE key of the group that needs to be deleted"
 *         required: true
 *         type: "string"
 *     responses:
 *       200:
 *         description: "Successful operation"
 *       404:
 *         description: "Group not found"
 */

exports.deleteGroup = async function (req, res, next) {
    log.debug(req.headers['test-title']);

    const bodyPK = req.params.bodyPK;
    log.debug(bodyPK);

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;
    let groupID = '';

    if (bodyPK) {
        groupID = await redis.get('primary:' + bodyPK);
        log.debug(groupID);
    }
    if (!groupID) {
        response.message = 'Error: no group matching bodyPK ' + bodyPK;
        statusCode = 404;
    } else {
        const data = { primaryEmail: groupID };
        log.debug(data.primaryEmail);

        try {
            const result = await runGsuiteOperation(gsuiteOperations.deleteGroup, data);
            response = { success: result.success, message: data.primaryEmail + ' group has been deleted', data: result.data };
            statusCode = result.code;
            log.debug(result);
            if (result.success) {
                await redis.del('group:' + bodyPK, 'primary:' + bodyPK, 'id:' + groupID).catch((err) => console.log('redis error: ' + err));
            }
        } catch (GsuiteError) {
            log.warn('GsuiteError');
            response = { success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }
    }

    return res.status(statusCode).json(response);
};

/**
 * @swagger
 *
 * /account:
 *   post:
 *     tags:
 *       - "Account"
 *     summary: "Create user account"
 *     description: "This endpoint is to create a deactivated Gsuite \
 *                   account. It will be activated at a later stage \
 *                   during the registration process"
 *     operationId: "createAccount"
 *     consumes:
 *       - "application/json"
 *     produces:
 *       - "application/json"
 *     parameters:
 *       - name: "data"
 *         in: "body"
 *         description: "User account object"
 *         required: true
 *         schema:
 *           $ref: "#/definitions/Account"
 *     responses:
 *       201:
 *         description: "Successful operation"
 *       400:
 *         description: "Invalid input"
 *       409:
 *         description: "Duplicate entity"
 */

exports.createAccount = async function (req, res, next) {
    log.debug(req.headers['test-title']);

    const data = req.body;

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;

    if (!data.userPK
        || !data.primaryEmail
        || !data.secondaryEmail
        || !data.password
        || !data.antenna
        || !data.name.givenName
        || !data.name.familyName) {
        response.message = 'Validation error: a required property is absent or empty';
        statusCode = 400;
    } else {
        const payload = {
            suspended: true,
            primaryEmail: data.primaryEmail,
            name: data.name,
            password: data.password,
            hashFunction: 'SHA-1',
            recoveryEmail: data.secondaryEmail,
            emails: [
                {
                    address: data.secondaryEmail,
                    type: 'home',
                    customType: '',
                    primary: true,
                },
            ],
            organizations: [
                {
                    department: data.antenna,
                },
            ],
            orgUnitPath: '/individuals',
            includeInGlobalAddressList: true,
        };

        try {
            const result = await runGsuiteOperation(gsuiteOperations.addAccount, payload);
            response = { success: result.success, message: result.data.primaryEmail + ' account has been created', data: result.data };
            statusCode = result.code;

            redis.hset('user:' + data.userPK, 'GsuiteAccount', data.primaryEmail, 'SecondaryEmail', data.secondaryEmail);
            redis.set('primary:' + data.userPK, data.primaryEmail);
            redis.set('primary:' + data.secondaryEmail, data.primaryEmail);
            redis.set('id:' + data.primaryEmail, data.userPK);
            redis.set('secondary:' + data.primaryEmail, data.secondaryEmail);
        } catch (GsuiteError) {
            log.warn('GsuiteError');
            response = { success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }
    }

    return res.status(statusCode).json(response);
};

/**
 * @swagger
 *
 * /account/{personPK}:
 *   put:
 *     description: Edit an user account
 *     tags:
 *       - Account
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: personPK
 *         description: The primary key of the gsuite user
 *         in: path
 *         required: true
 *         type: string
 *       - name: secondaryEmail
 *         description: The user's new alternative email (i.e. the one they used to register on MyAEGEE)
 *         in: body
 *         required: false
 *         type: string
 *       - name: password
 *         description: The password hashed in a SHA-1 format
 *         in: body
 *         required: false
 *         type: string
 *       - name: antennae # FIXME
 *         description: The antenna of the user
 *         in: body
 *         required: false
 *         type: string
 *       - name: givenName
 *         description: Name of the user
 *         in: body
 *         required: false
 *         type: string
 *       - name: familyName
 *         description: Surname of the user
 *         in: body
 *         required: false
 *         type: string
 *       - name: photoData
 *         description: A web-safe base64 representation of the image
 *         in: body
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: The user is created (deactivated)
 *         schema:
 *           '$ref': '#/definitions/successResponse'
 *       400:
 *         description: Validation error
 *         schema:
 *           '$ref': '#/definitions/generalResponse'
 *       500:
 *         description: Internal error
 *         schema:
 *           '$ref': '#/definitions/errorResponse'
 */

exports.editAccount = async function (req, res, next) {
    log.debug(req.headers['test-title']);

    const personPK = req.params.userPK;
    const data = req.body;

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;

    if (!personPK || Object.keys(data).length === 0) {
        response.message = 'Validation error: the primary key or payload is absent or empty';
        statusCode = 400;
    } else {
        const removeEmpty = (obj) => {
            Object.keys(obj).forEach((key) => (obj[key] == null) && delete obj[key]);
            return obj;
        };

        const payload = removeEmpty({

            ...data,
            hashFunction: data.password ? 'SHA-1' : null,
            emails: data.secondaryEmail ? [
                {
                    address: data.secondaryEmail,
                    type: 'home',
                    customType: '',
                    primary: true,
                },
            ] : null,
            organizations: data.antennae ? [{ department: data.antennae.toString() }] : null,
        });

        if (Object.keys(payload).length > 0) {
            payload.userKey = personPK;

            try {
                const result = await runGsuiteOperation(gsuiteOperations.editAccount, payload);
                response = { success: result.success, message: result.data[0].primaryEmail + ' account has been updated', data: result.data };
                statusCode = result.code;
            } catch (GsuiteError) {
                log.warn('GsuiteError');
                response = { success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
                statusCode = GsuiteError.code;
            }
        }
    }

    return res.status(statusCode).json(response);
};

/**
 * @swagger
 *
 * /account:
 *   get:
 *     description: Get all accounts on gsuite (used only once)
 *     tags:
 *       - Account
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: pageToken
 *         description: The token for the next page of results
 *         in: query
 *         required: false
 *         type: string
 *       - name: max
 *         description: Max returned (default ?max=10)
 *         in: query
 *         required: false
 *         type: string
 *       - name: q
 *         description: The query (default ?q=orgUnitPath=/individuals )
 *         in: query
 *         required: false
 *         type: string
 *       - name: sort
 *         description: Sorting order (default ?sort=ASCENDING)
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: The user list is returned
 *         schema:
 *           '$ref': '#/definitions/successResponse'
 *       403:
 *         description: Unauthorised
 *         schema:
 *           '$ref': '#/definitions/generalResponse'
 *       500:
 *         description: Internal error
 *         schema:
 *           '$ref': '#/definitions/errorResponse'
 */

exports.listAccounts = async function (req, res, next) {
    log.debug(req.headers['test-title']);

    const payload = {
        pageToken: req.query.pageToken,
        maxResults: req.query.max,
        query: req.query.q || 'orgUnitPath=/individuals',
        sortOrder: req.query.sort || 'ASCENDING',
        customer: config.customer_ID,
        orderBy: 'familyName',
    };

    try {
        const result = await runGsuiteOperation(gsuiteOperations.listAccounts, payload);
        response = { success: result.success, message: 'There you go mate', data: result.data };
        statusCode = result.code;
    } catch (GsuiteError) {
        log.warn('GsuiteError');
        response = { success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
        statusCode = GsuiteError.code;
    }

    return res.status(statusCode).json(response);
};

/**
 * @swagger
 *
 * /account/{userPK}/group:
 *   put:
 *     tags:
 *       - "Groups"
 *     summary: "Add/remove account membership to group"
 *     description: "This endpoint is used to modify an account's membership to a group, \
 *                   NOT a group"
 *     operationId: "editMembershipToGroup"
 *     consumes:
 *       - "application/json"
 *     produces:
 *       - "application/json"
 *     parameters:
 *       - name: "userPK"
 *         in: "path"
 *         description: "User that needs to be inserted/removed"
 *         required: true
 *         type: "string"
 *         example: "name.surname@aegee.eu"
 *       - name: "body"
 *         in: "body"
 *         description: "Operation & group info. Possible values for data.operation: add|remove|upgrade|downgrade"
 *         required: true
 *         schema:
 *           $ref: "#/definitions/Membership"
 *     responses:
 *       200:
 *         description: "Removal: Successful operation"
 *       201:
 *         description: "Creation: Successful operation"
 *       400:
 *         description: "Invalid input"
 *       404:
 *         description: "Member not found"
 *       409:
 *         description: "Member duplicate"
 */

// Possible values for data.operation: add|remove|upgrade|downgrade
exports.editMembershipToGroup = async function (req, res, next) {
    log.debug(req.headers['test-title']);

    const personPK = req.params.userPK;
    const data = req.body;

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;

    if (!data.groupPK
        || !data.operation
        || data.operation === 'upgrade' // NOT IMPLEMENTED YET
        || data.operation === 'downgrade' // NOT IMPLEMENTED YET
        || (data.operation !== 'add'
        && data.operation !== 'remove')) {
        response.message = 'Validation error: operation empty or not valid; or primaryKey is absent or empty';
        statusCode = 400;
    } else {
        const userID = await redis.get('primary:' + personPK);
        const groupID = await redis.get('primary:' + data.groupPK);
        log.debug(userID);
        log.debug(groupID);
        data.primaryEmail = groupID;
        data.userName = userID;

        try {
            let operation = null;
            data.operation === 'add'
                ? operation = gsuiteOperations.addUserInGroup
                : data.operation === 'remove' ? operation = gsuiteOperations.removeUserFromGroup
                    : operation = gsuiteOperations.changeUserGroupPrivilege;

            const result = await runGsuiteOperation(operation, data);
            response = { success: result.success, message: result.data.email + ' membership has been created', data: result.data };
            statusCode = result.code;

            if (data.operation === 'add') {
                redis.sadd('membership:' + userID, groupID);
                redis.sadd('members:' + groupID, userID);
            }
            if (data.operation === 'remove') {
                await redis.srem('membership:' + userID, groupID);
                await redis.srem('members:' + groupID, userID);
            }
        } catch (GsuiteError) {
            log.warn('GsuiteError');
            response = { success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }
    }

    return res.status(statusCode).json(response);
};

/**
 * @swagger
 *
 * /account/{userPK}/alias:
 *   put:
 *     tags:
 *       - "Account"
 *     summary: "Gives/remove alias to the user"
 *     description: "Gives/remove alias to the user. For remotion, one has \
 *                     to be precise on which user alias wants to delete, in case \
 *                     of multiple aliases"
 *     operationId: "updateAlias"
 *     consumes:
 *       - "application/json"
 *     produces:
 *       - "application/json"
 *     parameters:
 *       - name: "userPK"
 *         in: "path"
 *         description: "User whose alias needs to be updated (PK of MyAEGEE)"
 *         required: true
 *         type: "string"
 *       - name: "body"
 *         in: "body"
 *         description: "Operation to perform, and what the fuck this is not shown"
 *         required: true
 *         schema:
 *           $ref: "#/definitions/aliasOperation"
 *     responses:
 *       200:
 *         description: "Removal: Successful operation"
 *       201:
 *         description: "Creation: Successful operation"
 *       400:
 *         description: "Invalid payload"
 *       404:
 *         description: "Alias not found"
 *       409:
 *         description: "Alias already existing"
 */

exports.updateAlias = async function (req, res, next) {
    log.debug(req.headers['test-title']);

    const personPK = req.params.userPK;
    const data = req.body;

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;

    if (!data.aliasName
        || !data.operation
        || (data.operation !== 'add'
        && data.operation !== 'remove')) {
        response.message = 'Validation error: operation empty or not valid; or aliasName is absent or empty';
        statusCode = 400;
    } else {
        const operation = (data.operation === 'add' ? gsuiteOperations.addEmailAlias : gsuiteOperations.removeEmailAlias);

        const userID = await redis.get('primary:' + personPK);
        log.debug(userID);
        data.primaryEmail = userID;

        const payload = {
            primaryEmail: userID,
            aliasName: data.aliasName,
        };

        try {
            const result = await runGsuiteOperation(operation, payload);
            response = { success: result.success, message: result.data.email + ' membership has been created', data: result.data };
            statusCode = result.code;

            if (data.operation === 'add') {
                redis.pipeline()
                    .hset('user:' + personPK, 'GsuiteAlias', data.aliasName)
                    .set('alias:' + personPK, data.aliasName)
                    .set('primary:' + data.aliasName, userID)
                    .sadd('alias:' + userID, data.aliasName)
                    .exec();
            }
            if (data.operation === 'remove') {
                await redis.pipeline()
                    .srem('alias:' + userID, data.aliasName)
                    .del('alias:' + personPK, 'primary:' + data.aliasName)
                    .hdel('user:' + personPK, 'GsuiteAlias')
                    .exec();
            }
        } catch (GsuiteError) {
            log.warn(GsuiteError.errors);
            log.warn(req.headers['test-title']);
            // console.log(GsuiteError.errors);
            response = { success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }
    }

    return res.status(statusCode).json(response);
};

exports.getAliasFromRedis = async function (req, res, next) {
    log.debug(req.headers['test-title']);

    const personPK = req.params.userPK;

    const userID = await redis.get('primary:' + personPK);
    log.debug(userID);

    const response = { success: true,
        message: 'Aliases as follow',
        data: '' };

    const aliases = await redis.smembers('alias:' + userID)
        .catch((err) => {
            response.success = false;
            response.message = 'Something with redis';
            response.data = err;
        });

    response.data = aliases;

    return res.status(200).json(response);
};

/**
 * @swagger
 *
 * /calendar:
 *   post:
 *     tags:
 *       - "Calendar"
 *     summary: "Create Gsuite event on Calendar of Event"
 *     description: "This endpoint is to create an event on \
 *                   the Gsuite calendar of events, an organisation-wide \
 *                   shared calendar."
 *     operationId: "createCalEvent"
 *     consumes:
 *       - "application/json"
 *     produces:
 *       - "application/json"
 *     parameters:
 *       - name: "body"
 *         in: "body"
 *         description: "Created event object"
 *         required: true
 *         schema:
 *           $ref: '#/definitions/Event'
 *     responses:
 *       201:
 *         description: "Successful operation"
 *       400:
 *         description: "Invalid input"
 *       409:
 *         description: "Duplicate event"
 */

exports.createCalEvent = async function (req, res, next) {
    log.debug(req.headers['test-title']);

    const data = req.body;

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;

    if (!data.name
        || !data.startDate
        || !data.endDate
        || !data.description
        || !data.location
        || !data.eventID) {
        response.message = 'Validation error: a required property is absent or empty';
        statusCode = 400;
    } else {
        const payload = {
            id: data.eventID,
            summary: data.name,
            location: data.location,
            description: data.description,
            start: {
                // 'dateTime': '2015-05-28T09:00:00-07:00',
                // 'date': '2015-05-28',
                date: data.startDate,
                timeZone: 'Europe/Brussels',
            },
            end: {
                date: data.endDate,
                timeZone: 'Europe/Brussels',
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 10 },
                ],
            },
        };

        try {
            const result = await runGsuiteOperation(gsuiteOperations.addEvent, payload);
            response = { success: true, message: result.data + 'Event has been created', data: result.data };
            statusCode = result.code;
            // console.log(result.data); //FIXME remove next time
        } catch (GsuiteError) {
            log.warn('GsuiteError');
            response = { success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }
    }

    return res.status(statusCode).json(response);
};

// HELPER or INTERNAL METHODS/VARS
