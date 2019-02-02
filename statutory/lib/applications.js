const { errors } = require('oms-common-nodejs');
const moment = require('moment');
const request = require('request-promise-native');
const crypto = require('crypto');
const xlsx = require('node-xlsx').default;

const logger = require('./logger');
const mailer = require('./mailer');
const config = require('../config');
const { Event, Application, PaxLimit, VotesPerAntenna } = require('../models');
const constants = require('./constants');
const helpers = require('./helpers');
const { sequelize } = require('./sequelize');

exports.listAllApplications = async (req, res) => {
    if (!req.permissions.see_applications) {
        return errors.makeForbiddenError(res, 'You are not allowed to see applications.');
    }

    return res.json({
        success: true,
        data: req.event.applications
    });
};

exports.listAcceptedApplications = async (req, res) => {
    if (!req.permissions.see_participants_list) {
        return errors.makeForbiddenError(res, 'You are not allowed to see applications.');
    }

    const applications = req.event.applications
        .filter(application => application.status === 'accepted')
        .map(application => application.toJSON())
        .map((application) => {
            delete application.answers;
            delete application.board_comment;
            delete application.visa_required;
            delete application.status;
            delete application.email;
            delete application.gender;
            delete application.nationality;
            delete application.date_of_birth;
            delete application.meals;
            delete application.allergies;
            delete application.number_of_events_visited;

            delete application.visa_place_of_birth;
            delete application.visa_passport_number;
            delete application.visa_passport_issue_date;
            delete application.visa_passport_expiration_date;
            delete application.visa_passport_issue_authority;
            delete application.nationality;
            delete application.visa_embassy;
            delete application.date_of_birth;
            delete application.visa_street_and_house;
            delete application.visa_postal_code;
            delete application.visa_city;
            delete application.visa_country;

            return application;
        });

    return res.json({
        success: true,
        data: applications
    });
};

exports.listJCApplications = async (req, res) => {
    if (!req.permissions.see_applications_juridical) {
        return errors.makeForbiddenError(res, 'You are not allowed to see applications.');
    }

    const applications = req.event.applications
        .filter(application => application.status === 'accepted' && application.paid_fee)
        .map(application => application.toJSON())
        .map((application) => {
            delete application.answers;
            delete application.board_comment;
            delete application.visa_required;
            delete application.email;
            delete application.gender;
            delete application.nationality;
            delete application.date_of_birth;
            delete application.meals;
            delete application.allergies;
            delete application.number_of_events_visited;

            delete application.visa_place_of_birth;
            delete application.visa_passport_number;
            delete application.visa_passport_issue_date;
            delete application.visa_passport_expiration_date;
            delete application.visa_passport_issue_authority;
            delete application.nationality;
            delete application.visa_embassy;
            delete application.date_of_birth;
            delete application.visa_street_and_house;
            delete application.visa_postal_code;
            delete application.visa_city;
            delete application.visa_country;

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

    // Fetching users list
    const userBody = await request({
        url: config.core.url + ':' + config.core.port + '/members/' + req.application.user_id,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    });

    if (typeof userBody !== 'object') {
        throw new Error('Malformed response when fetching users: ' + userBody);
    }

    if (!userBody.success) {
        throw new Error('Error fetching users: ' + JSON.stringify(userBody));
    }

    if (req.body.body_id && !helpers.isMemberOf(userBody.data, req.body.body_id)) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    delete req.body.status;
    delete req.body.board_comment;
    delete req.body.participant_type;
    delete req.body.participant_order;
    delete req.body.attended;
    delete req.body.departed;
    delete req.body.cancelled;
    delete req.body.paid_fee;
    delete req.body.user_id;

    // Some fields are filled in from the user/body automatically.
    req.body.first_name = userBody.data.first_name;
    req.body.last_name = userBody.data.last_name;
    req.body.gender = userBody.data.gender;
    req.body.email = userBody.data.user.email;
    req.body.date_of_birth = userBody.data.date_of_birth;
    if (req.body.body_id) {
        // Shouldn't crash, if the person is not a member of a body,
        // it will be caught by helpers.isMemberOf() above.
        req.body.body_name = userBody.data.bodies.find(b => req.body.body_id === b.id).name;
    }

    // If user changed his body (by himself), reset his board comment and participant type/order.
    if (req.application.user_id === req.user.id && req.body.body_id && req.body.body_id !== req.application.body_id) {
        req.body.participant_type = null;
        req.body.participant_order = null;
        req.body.board_comment = null;
    }

    // Keeping old body, as apparently next line is changing req.application as well.
    const oldBody = req.application.body_id;
    const dbResult = await req.application.update(req.body);

    // Recalculating votes per delegate for this antenna, if user changed the body.
    // Both for new and old body.
    if (req.body.body_id && req.body.body_id !== oldBody) {
        await VotesPerAntenna.recalculateVotesForDelegates(req.event, oldBody);
        await VotesPerAntenna.recalculateVotesForDelegates(req.event, req.body.body_id);

    }

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

        const dbResult = await req.application.update(
            toUpdate,
            { returning: true }
        );

        // Recalculating votes per delegate for this antenna.
        await VotesPerAntenna.recalculateVotesForDelegates(req.event, req.application.body_id);

        return res.json({
            success: true,
            data: dbResult
        });
    };
}

exports.setApplicationCancelled = setApplicationBoolean('cancelled');
exports.setApplicationAttended = setApplicationBoolean('attended');
exports.setApplicationPaidFee = setApplicationBoolean('paid_fee');
exports.setApplicationRegistered = setApplicationBoolean('registered');
exports.setApplicationDeparted = setApplicationBoolean('departed');


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

    const dbResult = await req.application.update(
        { status: req.body.status },
        { returning: true }
    );

    // Recalculating votes per delegate for this antenna.
    await VotesPerAntenna.recalculateVotesForDelegates(req.event, req.application.body_id);

    return res.json({
        success: true,
        data: dbResult
    });
};

exports.setApplicationBoard = async (req, res) => {
    if (Number.isNaN(Number(req.params.application_id, 10))) {
        return errors.makeForbiddenError(res, 'You cannot edit board comment or participant type of yourself.');
    }

    // Either the current user or this user who has permission to see it is allowed.
    if (
        !req.permissions.set_board_comment_and_participant_type[req.application.body_id]
        && !req.permissions.set_board_comment_and_participant_type_global
    ) {
        return errors.makeForbiddenError(
            res,
            'You don\'t have permissions to change the board comment or participant type of this application.'
        );
    }

    // need to fetch body to get its body type
    const body = await request({
        url: config.core.url + ':' + config.core.port + '/bodies/' + req.application.body_id,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    });

    if (typeof body !== 'object') {
        throw new Error('Malformed response when fetching bodies: ' + body);
    }

    if (!body.success) {
        throw new Error('Error fetching body: ' + JSON.stringify(body));
    }

    const limit = await PaxLimit.fetchOrUseDefaultForBody(body.data, req.event.type);

    const toUpdate = {};
    if (typeof req.body.participant_type !== 'undefined') toUpdate.participant_type = req.body.participant_type;
    if (typeof req.body.participant_order !== 'undefined') toUpdate.participant_order = req.body.participant_order;
    if (typeof req.body.board_comment !== 'undefined') toUpdate.board_comment = req.body.board_comment;

    // Well, this is tricky.
    // Simplest way possible: executing it, then checking how much people
    // from this body with this pax type we have and matching it
    // against the limit for this body. If something goes wrong or there's a
    // calculation error, rollback everything. Advantages: don't need to worry
    // about validations, they'll fail the transaction.
    try {
        await sequelize.transaction(async (t) => {
            // First, saving the application.
            // If we've passed after this one, there's no duplicated, validations
            // and constraint take care about it.
            const dbResult = await req.application.update(toUpdate, { returning: true, transaction: t });

            // Recalculating votes per delegate for this antenna.
            await VotesPerAntenna.recalculateVotesForDelegates(req.event, req.application.body_id, t);

            // If the pax type is null (it wasn't updated or was unset)
            // that means also that pax order is null (look in validations).
            // Therefore, no need to check, the number couldn't increase because of that.
            // Also, to avoid querying on participant_type === null below.
            if (!dbResult.participant_type) {
                return res.json({
                    success: true,
                    data: dbResult
                });
            }

            // Second, get from database how much people we have for this event
            // from this body with this pax type.
            // If we got the validation error, it'll fail the transaction.
            // Therefore, all the data here is valid.
            const applicationsCount = await Application.count({ where: {
                event_id: dbResult.event_id,
                body_id: dbResult.body_id,
                participant_type: dbResult.participant_type
            }, transaction: t });

            if (limit[dbResult.participant_type] !== null) {
                // If the limit's value is not null and is less than
                // the applications amount (meaning, it increased by one within this transaction),
                // that means setting the pax order for this user was a mistake and
                // this needs to be rolled back.
                if (limit[dbResult.participant_type] < applicationsCount) {
                    throw new Error(`Too much applications \
for body #${dbResult.body_id} for type "${dbResult.participant_type}": \
expected ${limit[dbResult.participant_type]}, got ${applicationsCount}.`);
                }

                // If the participant_order is bigger than the limit (e.g. envoy (4) when only 3 envoys are eligible)
                // then rolling back as well.
                if (dbResult.participant_order > limit[dbResult.participant_type]) {
                    throw new Error(`Expected participant number from 1 to ${applicationsCount}, \
got participant type ${dbResult.participant_order}`);
                }
            }

            return res.json({
                success: true,
                data: dbResult
            });
        })
    } catch (err) {
        // Here we go only when the transaction has failed and rolled back.

        // If validation error, throw it further so general error handler can handle it.
        if (err.name && err.name === 'SequelizeValidationError') {
            throw err;
        }

        return errors.makeForbiddenError(res, err.message);
    }
};

exports.postApplication = async (req, res) => {
    if (!req.permissions.apply) {
        return errors.makeForbiddenError(res, 'The deadline for applications has passed or the applications period hasn\'t started yet.');
    }

    req.body.user_id = req.user.id;
    if (!helpers.isMemberOf(req.user, req.body.body_id)) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    delete req.body.status;
    delete req.body.board_comment;
    delete req.body.participant_type;
    delete req.body.participant_order;
    delete req.body.attended;
    delete req.body.departed;
    delete req.body.cancelled;
    delete req.body.paid_fee;

    req.body.event_id = req.event.id;

    // Some fields are filled in from the user/body automatically.
    req.body.first_name = req.user.first_name;
    req.body.last_name = req.user.last_name;
    req.body.gender = req.user.gender;
    req.body.email = req.user.user.email;
    req.body.body_name = req.user.bodies.find(b => req.body.body_id === b.id).name;
    req.body.date_of_birth = req.user.date_of_birth;

    // Doing it inside of a transaction, so it'd fail and revert if mail was not sent.
    await sequelize.transaction(async (t) => {
        const newApplication = await Application.create(req.body, { transaction: t });

        // We don't need to recalculate the votes amount, as the pax type is not set here.

        // Sending the mail to a user.
        await mailer.sendMail({
            from: 'oms-mailer@aegee.org',
            to: newApplication.email,
            subject: `You've successfully applied for ${req.event.name}`,
            template: 'statutory_applied.html',
            parameters: {
                application: newApplication,
                event: req.event
            }
        });

        return res.json({
            success: true,
            data: newApplication
        });
    })
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

    // Returns a CSV string
    const exportString = headers.map(wrap).join(',') + '\n' + filtered.map((application) => {
        // Generating random pw for a user.
        const password = crypto.randomBytes(5).toString('hex');

        return [
            '', // Title
            application.first_name,
            application.last_name,
            '', // Structure level
            application.id, // Participant number
            application.participant_type,
            `Body ID: ${application.body_id} (${application.body_name}). User ID: ${application.user_id}`, // Comment
            1, // Is active
            1, // Is present
            0, // Is committee
            password,
            application.email // User email, currently not fetched from the system.
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

    const filtered = req.event.applications.filter(app => !app.cancelled);

    const headers = [
        'Application ID',
        'Created at',
        'Updated at',
        'First name',
        'Last name',
        'Email',
        'Gender',
        'Body ID',
        'Body name',
        'Participant type',
        'Board comment',
        'Confirmed?',
        'Attended?',
        'Departed?',
        ...req.event.questions.map(q => q.description)
    ];

    // A helper uset to pretty-format values.
    const beautify = value => {
        // If it's boolean, display it as Yes/No instead of true/false
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }

        // If it's date, return date formatted.
        if (Object.prototype.toString.call(value) === '[object Date]') {
            return moment(value).format('YYYY-MM-DD HH:mm:SS')
        }

        // Else, present it as it is.
        return value;
    }

    const resultArray = filtered.map((application) => {
        return [
            application.id,
            beautify(application.created_at),
            beautify(application.updated_at),
            application.first_name,
            application.last_name,
            application.email,
            application.gender,
            application.body_id,
            application.body_name,
            application.participant_type,
            application.board_comment,
            beautify(application.paid_fee),
            beautify(application.attended),
            beautify(application.departed),
            ...application.answers.map(beautify)
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
