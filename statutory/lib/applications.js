const { errors } = require('oms-common-nodejs');
const moment = require('moment');
const request = require('request-promise-native');
const crypto = require('crypto');
const xlsx = require('node-xlsx').default;

const logger = require('./logger');
const config = require('../config');
const { Application } = require('../models');
const constants = require('./constants');
const helpers = require('./helpers');

exports.listAllApplications = async (req, res) => {
    if (!req.permissions.see_applications) {
        return errors.makeForbiddenError(res, 'You are not allowed to see applications.');
    }

    return res.json({
        success: true,
        data: req.event.applications.sort((a, b) => b.id - a.id)
    });
};

exports.listAcceptedApplications = async (req, res) => {
    const applications = req.event.applications
        .filter(application => application.status === 'accepted')
        .map(application => application.toJSON())
        .map((application) => {
            delete application.answers;
            delete application.board_comment;
            delete application.visa_required;
            delete application.status;

            return application;
        });

    return res.json({
        success: true,
        data: applications
    });
};

exports.getStats = async (req, res) => {
    const statsObject = {
        by_date: [],
        by_date_cumulative: [],
        by_body: [],
        by_type: []
    };

    // Filtering out cancelled applications.
    const applications = req.event.applications.filter(app => !app.cancelled);

    // By date
    const dates = applications.map(app => moment(app.created_at).format('YYYY-MM-DD'))
        .filter((elt, index, array) => array.indexOf(elt) === index)
        .sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    let cumulativeSum = 0;

    // Iterating through dates from the first one to the last one incrementing by day.
    for (let date = moment(startDate, 'YYYY-MM-DD'); date.isSameOrBefore(moment(endDate, 'YYYY-MM-DD')); date = date.add(1, 'day')) {
        const dateFormatted = moment(date).format('YYYY-MM-DD');
        const applicationsAmount = applications
            .filter(elt => moment(elt.created_at).format('YYYY-MM-DD') === dateFormatted)
            .length;

        cumulativeSum += applicationsAmount;
        statsObject.by_date.push({ date: dateFormatted, value: applicationsAmount });
        statsObject.by_date_cumulative.push({ date: dateFormatted, value: cumulativeSum });
    }

    // By body
    statsObject.by_body = applications.reduce((acc, val) => {
        const existing = acc.find(obj => obj.body_id === val.body_id);
        if (existing) {
            existing.value += 1;
        } else {
            acc.push({ body_id: val.body_id, value: 1 });
        }
        return acc;
    }, []).sort((a, b) => b.value - a.value);

    // By pax type
    statsObject.by_type = applications.reduce((acc, val) => {
        const existing = acc.find(obj => obj.type === val.participant_type);
        if (existing) {
            existing.value += 1;
        } else {
            acc.push({ type: val.participant_type, value: 1 });
        }
        return acc;
    }, []);

    // Not sure of what to add here

    return res.json({
        success: true,
        data: statsObject
    });
};

exports.listBoardView = async (req, res) => {
    if (Number.isNaN(parseInt(req.params.body_id, 10))) {
        return errors.makeBadRequestError(res, 'Body ID should be a number.');
    }

    if (!req.permissions.see_boardview_of[req.params.body_id] && !req.permissions.see_boardview_global) {
        return errors.makeForbiddenError(res, 'You are not allowed to see the boardview of this body.');
    }

    const applications = req.event.applications
        .map(application => application.toJSON())
        .filter(application => application.body_id === parseInt(req.params.body_id, 10));

    return res.json({
        success: true,
        data: applications
    });
};

exports.getApplication = async (req, res) => {
    if (!req.permissions.see_application) {
        return errors.makeForbiddenError(res, 'You are not allowed to see this application.');
    }

    const application = req.application.toJSON();
    application.permissions = req.permissions;

    return res.json({
        success: true,
        data: application
    });
};

exports.updateApplication = async (req, res) => {
    if (!req.permissions.edit_application) {
        return errors.makeForbiddenError(res, 'You cannot edit this application.');
    }

    if (req.body.body_id && !helpers.isMemberOf(req.user, req.body.body_id)) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    delete req.body.status;
    delete req.body.board_comment;
    delete req.body.participant_type;
    delete req.body.attended;
    delete req.body.cancelled;
    delete req.body.paid_fee;

    // If user changed his body (by himself), reset his board comment and participant type.
    if (req.application.user_id === req.user.id && req.body.body_id && req.body.body_id !== req.application.body_id) {
        req.body.participant_type = null;
        req.body.board_comment = null;
    }

    const dbResult = await req.application.update(req.body);

    return res.json({
        success: true,
        data: dbResult
    });
};

function setApplicationBoolean(key) {
    return async (req, res) => {
        // Only 'cancelled' can work with '/me' postfix.
        if (key !== 'cancelled' && req.params.application_id === constants.CURRENT_USER_PREFIX) {
            return errors.makeForbiddenError(res, `You cannot change the "${key}" attribute through this endpoint.`);
        }

        // Either the current user or this user who has permission to see it is allowed.
        if (!req.permissions['set_application_' + key]) {
            return errors.makeForbiddenError(
                res,
                `You don't have permissions to change the "${key}" attribute of this application.`
            );
        }

        const toUpdate = {};
        toUpdate[key] = req.body[key];

        const dbResult = await Application.update(toUpdate, { where: { id: req.application.id }, returning: true });

        return res.json({
            success: true,
            data: dbResult[1][0]
        });
    };
}

exports.setApplicationCancelled = setApplicationBoolean('cancelled');
exports.setApplicationAttended = setApplicationBoolean('attended');
exports.setApplicationPaidFee = setApplicationBoolean('paid_fee');

exports.setApplicationStatus = async (req, res) => {
    if (Number.isNaN(Number(req.params.application_id, 10))) {
        return errors.makeForbiddenError(res, 'You cannot edit status of yourself.');
    }

    // Either the current user or this user who has permission to see it is allowed.
    if (!req.permissions.change_status) {
        return errors.makeForbiddenError(
            res,
            'You don\'t have permissions to change the "status" attribute of this application.'
        );
    }

    const dbResult = await Application.update(
        { status: req.body.status },
        { where: { id: req.application.id }, returning: true }
    );

    return res.json({
        success: true,
        data: dbResult[1][0]
    });
};

exports.setApplicationBoard = async (req, res) => {
    if (Number.isNaN(Number(req.params.application_id, 10))) {
        return errors.makeForbiddenError(res, 'You cannot edit board comment or participant type of yourself.');
    }

    // Either the current user or this user who has permission to see it is allowed.
    if (!req.permissions.set_board_comment_and_participant_type[req.application.body_id] && !req.permissions.set_board_comment_and_participant_type_global) {
        return errors.makeForbiddenError(
            res,
            'You don\'t have permissions to change the board comment or participant type of this application.'
        );
    }

    const toUpdate = {};
    if (req.body.participant_type) toUpdate.participant_type = req.body.participant_type;
    if (req.body.board_comment) toUpdate.board_comment = req.body.board_comment;

    const dbResult = await Application.update(
        toUpdate,
        { where: { id: req.application.id }, returning: true }
    );

    return res.json({
        success: true,
        data: dbResult[1][0]
    });
};

exports.postApplication = async (req, res) => {
    if (!req.permissions.apply) {
        return errors.makeForbiddenError(res, 'The deadline for applications has passed or the applications period hasn\'t started yet.');
    }

    req.body.user_id = req.user.id;
    const application = req.event.applications.find(pax => pax.user_id === req.body.user_id);

    if (application) {
        return errors.makeBadRequestError(res, `There's already application with this ID in the system. \
If it's yours, please update it via PUT /events/:event_id/applications/${constants.CURRENT_USER_PREFIX}.`);
    }

    if (!helpers.isMemberOf(req.user, req.body.body_id)) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    delete req.body.status;
    delete req.body.board_comment;
    delete req.body.participant_type;
    delete req.body.attended;
    delete req.body.cancelled;
    delete req.body.paid_fee;

    req.body.event_id = req.event.id;

    const newApplication = await Application.create(req.body);

    return res.json({
        success: true,
        data: newApplication
    });
};

exports.exportOpenslides = async (req, res) => {
    // Exporting users to mass-import into OpenSlides.
    // The file structure is CSV file with this headers in the first row:
    // Title, Given name, Surname, Structure level, Participant number, Groups, Comment, Is active, Is present, Is committee, Initial password Email
    // This endpoint will generate passwords for each user. If you do it 2 times, there would
    // be 2 different set of passwords, keep that in mind.
    // For more reference on OpenSlides page, open your OpenSlides instance (or https://demo.openslides.org),
    // then go to Participants -> Import and read the specification at the bottom of the page.

    if (!req.permissions.export) {
        return errors.makeForbiddenError(res, 'You are not allowed to see statistics.');
    }

    // Fetching users list
    const usersBody = await request({
        url: config.core.url + ':' + config.core.port + '/members',
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    });

    if (typeof usersBody !== 'object') {
        return errors.makeInternalError(res, 'Malformed response when fetching users: ' + usersBody);
    }

    if (!usersBody.success) {
        return errors.makeInternalError(res, 'Error fetching users: ' + usersBody);
    }

    const users = usersBody.data;

    const filtered = req.event.applications.filter(app => !app.cancelled);
    const wrap = string => '"' + string + '"';

    const headers = [
        'Title',
        'Given name',
        'Surname',
        'Structure level',
        'Participant number',
        'Groups',
        'Comment',
        'Is active',
        'Is present',
        'Is committee',
        'Initial password',
        'Email'
    ];

    const exportString = headers.map(wrap).join(',') + '\n' + filtered.map((application) => {
        // Returns a CSV string
        // Finding a user with corresponding ID
        const user = users.find(u => u.id === application.user_id);

        // If the user is not found (which should not happen ever), he/she is skipped and warning is raised.
        if (!user) {
            logger.error(`User for application ${application.id} (user_id ${application.user_id}) is not found.`);
            return '';
        }

        // Generating random pw for a user.
        const password = crypto.randomBytes(5).toString('hex');

        return [
            '', // Title
            user.first_name,
            user.last_name,
            '', // Structure level
            application.id, // Participant number
            application.participant_type,
            `Body ID: ${application.body_id}. User ID: ${application.user_id}`, // Comment
            1, // Is active
            1, // Is present
            0, // Is committee
            password,
            '' // User email, currently not fetched from the system.
        ].map(wrap).join(',');
    }).filter(line => line.length > 0).join('\n');


    res.setHeader('Content-type', 'text/csv');
    res.setHeader('Content-disposition', 'attachment; filename=openslides.csv');

    return res.send(exportString);
};

exports.exportAll = async (req, res) => {
    // Exporting users as XLSX for local organizers/Chair/CD/whoever.
    if (!req.permissions.export) {
        return errors.makeForbiddenError(res, 'You are not allowed to see statistics.');
    }

    // Fetching users list
    const [usersBody, bodiesBody] = await Promise.all(['/members', '/bodies'].map(key => request({
        url: config.core.url + ':' + config.core.port + key,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    })));

    if (typeof usersBody !== 'object') {
        return errors.makeInternalError(res, 'Malformed response when fetching users: ' + usersBody);
    }

    if (!usersBody.success) {
        return errors.makeInternalError(res, 'Error fetching users: ' + usersBody);
    }

    if (typeof bodiesBody !== 'object') {
        return errors.makeInternalError(res, 'Malformed response when fetching users: ' + bodiesBody);
    }

    if (!bodiesBody.success) {
        return errors.makeInternalError(res, 'Error fetching users: ' + bodiesBody);
    }

    const users = usersBody.data;
    const bodies = bodiesBody.data;

    const filtered = req.event.applications.filter(app => !app.cancelled);

    const headers = [
        'Application ID',
        'First name',
        'Last name',
        'Email',
        'Body ID',
        'Body name',
        'Participant type',
        'Board comment',
        'Paid fee?',
        'Attended?',
        ...req.event.questions.map(q => q.description)
    ];

    const resultArray = filtered.map((application) => {
        const user = users.find(u => u.id === application.user_id);

        // If the user is not found (which should not happen ever), he/she is skipped and warning is raised.
        if (!user) {
            logger.error(`User for application ${application.id} (user_id ${application.user_id}) is not found.`);
            return null;
        }

        const body = bodies.find(b => b.id === application.body_id);

        // If the user is not found (which should not happen ever), he/she is skipped and warning is raised.
        if (!body) {
            logger.error(`Body for application ${application.id} (body_id ${application.body_id}) is not found.`);
            return null;
        }

        return [
            application.id,
            user.first_name,
            user.last_name,
            '', // to pre-populate later
            application.body_id,
            body.name,
            application.participant_type,
            application.board_comment,
            application.paid_fee ? 'Yes' : 'No',
            application.attended ? 'Yes' : 'No',
            ...application.answers.map((answer) => {
                // If it's boolean, display it as Yes/No instead of true/false
                if (typeof answer === 'boolean') {
                    return answer ? 'Yes' : 'No';
                }

                return answer;
            })
        ];
    }).filter(pax => !!pax); // to filter out null values

    const resultBuffer = xlsx.build([
        {
            name: 'Application stats',
            data: [
                headers,
                ...resultArray
            ]
        }
    ]);


    res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-disposition', 'attachment; filename=stats.xlsx');

    return res.send(resultBuffer);
};
