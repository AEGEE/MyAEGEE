const errors = require('./errors');
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
            include: [Application]
        }],
        order: [
            ['created_at', 'ASC'],
            [Attendance, 'starts', 'ASC']
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

exports.markPlenaryAttendance = async (req, res) => {
    if (!req.permissions.mark_attendance) {
        return errors.makeForbiddenError(res, 'You cannot manage plenaries.');
    }

    // First, fetch application.
    const application = await Application.findOne({
        where: {
            id: req.body.application_id,
            event_id: req.event.id
        }
    });

    if (!application) {
        return errors.makeNotFoundError(res, 'The application is not found.');
    }

    // Second, there can be 2 cases:
    // 1) there is the attendance for this user where ends = null, if so, updating it (marking user as left)
    // 2) there's no attendance where ends = null (either there are no attendances at all or
    // there are a few where ends != null), if so, creating a new with start = current time.
    const existingAttendance = await Attendance.findOne({
        where: {
            ends: null,
            plenary_id: req.plenary.id,
            application_id: application.id
        }
    });

    // case 1.
    if (existingAttendance) {
        await existingAttendance.update({ ends: new Date() });
        return res.json({
            success: true,
            data: existingAttendance
        });
    }

    // case 2.
    const newAttendance = await Attendance.create({
        starts: new Date(),
        ends: null,
        application_id: application.id,
        plenary_id: req.plenary.id
    });
    return res.json({
        success: true,
        data: newAttendance
    });
};
