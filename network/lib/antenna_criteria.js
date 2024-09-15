const { AntennaCriterion } = require('../models');
const errors = require('./errors');

exports.listCriteria = async (req, res) => {
    if (!req.permissions.manage_antenna_criteria) {
        return errors.makeForbiddenError(res, 'You are not allowed to list Antenna Criteria.');
    }

    const criteria = await AntennaCriterion.findAll({
        where: { agora_id: Number(req.params.agora_id) }
    });

    return res.json({
        success: true,
        data: criteria
    });
};

exports.setCriterion = async (req, res) => {
    if (!['communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report'].includes(req.body.antenna_criterion)) {
        return errors.makeValidationError(res, 'This is not a valid criterion.');
    }

    const criterion = req.body.antenna_criterion.replace(/ /g, '_');

    if (!req.permissions.antenna_criteria[criterion]) {
        return errors.makeForbiddenError(res, 'You are not allowed to set fulfilment of the criterion ' + criterion + '.');
    }

    if (req.body.antenna_criterion === 'communication' && req.body.value === 'exception' && !req.permissions.antenna_criteria.communication_exception) {
        return errors.makeForbiddenError(res, 'You are not allowed to give exceptions to the Antenna Criterion `communication`.');
    }

    // The `.upsert()` method returns an object [result, created],
    // where `created` is a boolen whether the result was created or updated
    const result = await AntennaCriterion.upsert(req.body);

    return res.json({
        success: true,
        data: result[0]
    });
};
