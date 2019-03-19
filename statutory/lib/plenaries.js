const moment = require('moment');

const errors = require('./errors');
const constants = require('./constants');
const helpers = require('./helpers');
const { Plenary, Attendance, Application } = require('../models');

exports.findPlenary = async (req, res, next) => {
    if (Number.isNaN(Number(req.params.plenary_id))) {
        return errors.makeBadRequestError(res, 'The plenary ID is invalid.');
    }

    const plenary = await Plenary.findByPk(Number(req.params.plenary_id));
    if (!plenary) {
        return errors.makeNotFoundError(res, 'Plenary is not found.');
    }

    req.plenary = plenary;
    return next();
};

exports.listAllPlenaries = async (req, res) => {
    if (!req.permissions.see_plenaries) {
        return errors.makeForbiddenError(res, 'You cannot manage plenaries.');
    }

    const plenaries = await Plenary.findAll({
        where: { event_id: req.event.id },
        order: [['created_at', 'ASC']]
    });
    return res.json({
        success: true,
        data: plenaries
    });
};

exports.createPlenary = async (req, res) => {
    if (!req.permissions.manage_plenaries) {
        return errors.makeForbiddenError(res, 'You cannot manage plenaries.');
    }

    req.body.event_id = req.event.id;

    const newPlenary = await Plenary.create(req.body);

    return res.json({
        success: true,
        data: newPlenary
    });
};

exports.editPlenary = async (req, res) => {
    if (!req.permissions.manage_plenaries) {
        return errors.makeForbiddenError(res, 'You cannot manage plenaries.');
    }

    await req.plenary.update(req.body);

    return res.json({
        success: true,
        data: req.plenary
    });
};

exports.findPlenaryWithAttendances = async (req, res) => {
    if (!req.permissions.see_plenaries) {
        return errors.makeForbiddenError(res, 'You cannot see this plenary.');
    }

    if (Number.isNaN(Number(req.params.plenary_id))) {
        return errors.makeBadRequestError(res, 'The plenary ID is invalid.');
    }

    const plenary = await Plenary.findOne({
        where: { id: Number(req.params.plenary_id) },
        include: [{
            model: Attendance,
            include: [{
                model: Application,
                attributes: constants.ALLOWED_PLENARY_ATTENDANCE_FIELDS
            }]
        }],
        order: [
            ['created_at', 'ASC'],
            [Attendance, 'starts', 'DESC']
        ]
    });
    if (!plenary) {
        return errors.makeNotFoundError(res, 'Plenary is not found.');
    }

    return res.json({
        success: true,
        data: plenary
    });
};

exports.listPlenariesStats = async (req, res) => {
    if (!req.permissions.see_plenaries) {
        return errors.makeForbiddenError(res, 'You cannot see stats.');
    }

    const plenaries = await Plenary.findAll({
        where: { event_id: req.event.id },
        include: [Attendance]
    });
    const applications = await Application.findAll({
        where: {
            event_id: req.event.id,
            participant_type: 'delegate'
        },
        attributes: constants.ALLOWED_PLENARY_ATTENDANCE_FIELDS
    });

    // Calculating how much time were tracked for each application for each plenary.
    // TODO: refactor, O(n^3) isn't very nice.
    const result = plenaries.map(plenary => {
        const plenaryToChange = plenary.toJSON();
        plenaryToChange.applications = applications.map(application => {
            const applicationToChange = application.toJSON();
            const applicationAttendances = plenary.attendances.find(a => a.application_id === applicationToChange.id);
            applicationToChange.attendances = applicationAttendances.map(attendance => {
                attendance.timeTracked = helpers.calculateTimeForPlenary(attendance, plenary);
            });

            return applicationToChange;
        });

        return plenaryToChange;
    });

    return res.json({
        success: true,
        data: result
    });
}

exports.markPlenaryAttendance = async (req, res) => {
    if (!req.permissions.mark_attendance) {
        return errors.makeForbiddenError(res, 'You cannot manage plenaries.');
    }

    if (!helpers.isNumber(req.body.application_id)) {
        return errors.makeBadRequestError(res, 'The application ID is not a number.');
    }

    if (moment().isAfter(req.plenary.ends)) {
        return errors.makeForbiddenError(res, 'The plenary is over already, cannot mark any more members.');
    }

    // First, fetch application.
    const application = await Application.findOne({
        where: {
            id: req.body.application_id,
            event_id: req.event.id
        },
        attributes: constants.ALLOWED_PLENARY_ATTENDANCE_FIELDS
    });

    if (!application) {
        return errors.makeNotFoundError(res, 'The application is not found.');
    }

    if (application.participant_type !== 'delegate') {
        return errors.makeForbiddenError(res, 'The applicant is not a delegate.');
    }

    // Second, there can be 2 cases:
    // 1) there is the attendance for this user where ends = null, if so, updating it (marking user as left)
    // 2) there's no attendance where ends = null (either there are no attendances at all or
    // there are a few where ends != null), if so, creating a new with start = current time.
    let attendance = await Attendance.findOne({
        where: {
            ends: null,
            plenary_id: req.plenary.id,
            application_id: application.id
        }
    });

    if (attendance) {
        // case 1.
        await attendance.update({ ends: new Date() });
    } else {
        // case 2.
        attendance = await Attendance.create({
            starts: new Date(),
            ends: null,
            application_id: application.id,
            plenary_id: req.plenary.id
        });
    }

    const attendanceToReturn = attendance.toJSON();
    attendanceToReturn.application = application;

    return res.json({
        success: true,
        data: attendanceToReturn
    });
};
