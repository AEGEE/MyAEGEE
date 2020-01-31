const {
    User,
    MailConfirmation,
    Campaign
} = require('../models');
const errors = require('../lib/errors');

module.exports.registerUser = async (req, res) => {
    const campaign = await Campaign.findOne({ where: { url: req.params.campaign_id } });
    if (!campaign) {
        return errors.makeNotFoundError(res, 'Campaign is not found.');
    }
    if (!campaign.active) {
        return errors.makeForbiddenError(res, 'Campaign is not active.');
    }

    const user = await User.scope('noExtraFields').create({
        ...req.body,
        campaign_id: campaign.id
    });
    const confirmation = await MailConfirmation.createForUser(user.id);

    return res.json({
        success: true,
        data: {
            user,
            confirmation
        }
    });
};
