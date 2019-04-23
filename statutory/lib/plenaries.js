const Moment = require('moment');
const MomentRange = require('moment-range');
const xlsx = require('node-xlsx');

const moment = MomentRange.extendMoment(Moment);


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

    // Preloading values.
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
        order: [
            ['starts', 'ASC'],
            [Attendance, 'starts', 'ASC']
        ],
        include: [Attendance]
    });
    const applications = await Application.findAll({
        where: {
            event_id: req.event.id,
            participant_type: 'delegate'
        },
        order: [['id', 'ASC']],
        attributes: constants.ALLOWED_PLENARY_ATTENDANCE_FIELDS
    });

    // First sheet with general status with all the info.
    const firstSheet = {
        name: 'Stats (general)',
        data: [
            // headers
            [
                'Application ID',
                'First and last name',
                'Body name',
                ...plenaries.map(plenary => `${plenary.name} (seconds)`),
                ...plenaries.map(plenary => `${plenary.name} (%)`),
                'Total percent'
            ],
            // the actual data
            ...applications.map((application) => {
                // calculating how much time in total this participant has attended
                // for each plenary, in seconds
                const plenariesAttendanceInSeconds = plenaries.map((plenary) => {
                    return plenary
                        .attendances
                        .filter(a => a.application_id === application.id)
                        .map(attendance => helpers.calculateTimeForPlenary(attendance, plenary))
                        .reduce((acc, val) => acc + val, 0);
                });

                // same, but in percents
                const plenariesAttendanceInPercents = plenariesAttendanceInSeconds
                    .map((attendanceLength, index) => {
                        // we need the plenary...
                        const plenary = plenaries[index];

                        // and its total plenary duration in seconds
                        const plenaryDuration = moment.range(plenary.starts, plenary.ends).diff('seconds', true);
                        return attendanceLength / plenaryDuration * 100;
                    });

                // aaaand the average percent
                const avgPercentPerApplication = plenariesAttendanceInPercents
                    .reduce((acc, val) => acc + val, 0)
                    / plenariesAttendanceInPercents.length;

                return [
                    application.id,
                    application.first_name + ' ' + application.last_name,
                    application.body_name,
                    ...plenariesAttendanceInSeconds.map(attendance => attendance.toFixed(2)),
                    ...plenariesAttendanceInPercents.map(attendance => attendance.toFixed(2) + '%'),
                    avgPercentPerApplication.toFixed(2) + '%'
                ];
            })
        ]
    };

    const plenariesSheets = plenaries.map((plenary, index) => {
        // total plenary duration in seconds
        const plenaryDuration = moment.range(plenary.starts, plenary.ends).diff('seconds', true);

        return {
            name: `${index + 1} - ${plenary.name}`, // to prevent duplicate sheets when there's 2 plenaries with the same name
            data: [
                ['Name', plenary.name],
                ['Starts at', helpers.beautify(plenary.starts)],
                ['Ends at', helpers.beautify(plenary.ends)],
                ['Duration in seconds', plenaryDuration.toFixed(2)],
                [], // an empty line,
                // headers
                [
                    'Application ID',
                    'First and last name',
                    'Body name',
                    'Starts',
                    'Ends',
                    'Time in seconds',
                    'Time in percent'
                ],
                // attendances data
                ...plenary.attendances.map((attendance) => {
                    const attendanceDuration = helpers.calculateTimeForPlenary(attendance, plenary);
                    const application = applications.find(a => a.id === attendance.application_id);

                    return [
                        application.id,
                        application.first_name + ' ' + application.last_name,
                        application.body_name,
                        helpers.beautify(attendance.starts),
                        helpers.beautify(attendance.ends),
                        attendanceDuration.toFixed(2),
                        (attendanceDuration / plenaryDuration * 100).toFixed(2) + '%'
                    ];
                })
            ]
        };
    });

    const resultBuffer = xlsx.build([
        firstSheet,
        ...plenariesSheets
    ]);


    res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-disposition', 'attachment; filename=plenary.xlsx');

    return res.send(resultBuffer);
};

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

    // Only delegates and envoys (of CAs) are allowed.
    if (!['delegate', 'envoy'].includes(application.participant_type)) {
        return errors.makeForbiddenError(res, 'The applicant is not a delegate or envoy.');
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
