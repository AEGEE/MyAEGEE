const { ResourceCategory, ResourceLink } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const { sequelize } = require('../lib/sequelize');

const MANAGE_PERMISSION = 'global:manage:resources';

const LINKS_ORDER = [
    [{ model: ResourceLink, as: 'links' }, 'position', 'ASC'],
    [{ model: ResourceLink, as: 'links' }, 'id', 'ASC']
];

const ensureCanManage = (req, res) => {
    if (req.permissions.hasPermission(MANAGE_PERMISSION)) {
        return true;
    }

    errors.makeForbiddenError(res, `Permission ${MANAGE_PERMISSION} is required, but not present.`);
    return false;
};

const pickFields = (body, fields) => {
    const picked = helpers.whitelistObject(body, fields);
    for (const field of Object.keys(picked)) {
        if (typeof picked[field] === 'undefined') delete picked[field];
    }
    return picked;
};

const nextPosition = async (Model, where, transaction) => {
    const max = await Model.max('position', { where, transaction });
    return Number.isInteger(max) ? max + 1 : 0;
};

// Every ID exactly once, so a stale page can't drop or duplicate items.
const getOrderError = (ids, existingIds) => {
    if (!Array.isArray(ids) || !ids.every(Number.isInteger)) {
        return 'ids should be an array of IDs.';
    }

    const sent = new Set(ids);
    if (sent.size !== ids.length || sent.size !== existingIds.length || !existingIds.every((id) => sent.has(id))) {
        return 'ids should list every current item exactly once. Reload the page and try again.';
    }

    return null;
};

const saveOrder = (Model, ids) => sequelize.transaction(async (transaction) => {
    for (const [position, id] of ids.entries()) {
        await Model.update({ position }, { where: { id }, transaction });
    }
});

const toCategoryId = (value) => {
    const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const findCategoryId = async (value) => {
    const id = toCategoryId(value);
    return id && (await ResourceCategory.count({ where: { id } })) > 0 ? id : null;
};

const findCategoryWithLinks = (id) => ResourceCategory.findByPk(id, {
    include: [{ model: ResourceLink, as: 'links' }],
    order: LINKS_ORDER
});

exports.listAllResources = async (req, res) => {
    const categories = await ResourceCategory.findAll({
        include: [{ model: ResourceLink, as: 'links' }],
        order: [['position', 'ASC'], ['id', 'ASC'], ...LINKS_ORDER]
    });

    return res.json({
        success: true,
        data: categories
    });
};

exports.createCategory = async (req, res) => {
    if (!ensureCanManage(req, res)) return;

    const category = await sequelize.transaction(async (transaction) => ResourceCategory.create({
        ...helpers.whitelistObject(req.body, constants.FIELDS_TO_UPDATE.RESOURCE_CATEGORY),
        position: await nextPosition(ResourceCategory, {}, transaction)
    }, { transaction }));

    return res.json({
        success: true,
        data: category
    });
};

exports.setCategoriesOrder = async (req, res) => {
    if (!ensureCanManage(req, res)) return;

    const ids = req.body && req.body.ids;
    const existingIds = (await ResourceCategory.findAll({ attributes: ['id'] })).map((category) => category.id);
    const orderError = getOrderError(ids, existingIds);
    if (orderError) {
        return errors.makeValidationError(res, orderError);
    }

    await saveOrder(ResourceCategory, ids);

    return exports.listAllResources(req, res);
};

exports.getCategory = async (req, res) => {
    return res.json({
        success: true,
        data: await findCategoryWithLinks(req.currentResourceCategory.id)
    });
};

exports.updateCategory = async (req, res) => {
    if (!ensureCanManage(req, res)) return;

    await req.currentResourceCategory.update(pickFields(req.body, constants.FIELDS_TO_UPDATE.RESOURCE_CATEGORY));
    await req.currentResourceCategory.reload();

    return res.json({
        success: true,
        data: req.currentResourceCategory
    });
};

exports.deleteCategory = async (req, res) => {
    if (!ensureCanManage(req, res)) return;

    const linksCount = await ResourceLink.count({ where: { category_id: req.currentResourceCategory.id } });
    if (linksCount > 0) {
        return errors.makeConflictError(res, `This section still has ${linksCount} link(s). Move or delete them first.`);
    }

    await req.currentResourceCategory.destroy();

    return res.json({
        success: true,
        message: 'Section is deleted.'
    });
};

exports.setLinksOrder = async (req, res) => {
    if (!ensureCanManage(req, res)) return;

    const ids = req.body && req.body.ids;
    const existingIds = (await ResourceLink.findAll({
        attributes: ['id'],
        where: { category_id: req.currentResourceCategory.id }
    })).map((link) => link.id);
    const orderError = getOrderError(ids, existingIds);
    if (orderError) {
        return errors.makeValidationError(res, orderError);
    }

    await saveOrder(ResourceLink, ids);

    return res.json({
        success: true,
        data: await findCategoryWithLinks(req.currentResourceCategory.id)
    });
};

exports.createLink = async (req, res) => {
    if (!ensureCanManage(req, res)) return;

    const fields = helpers.whitelistObject(req.body, constants.FIELDS_TO_UPDATE.RESOURCE_LINK);
    const categoryId = await findCategoryId(fields.category_id);
    if (!categoryId) {
        return errors.makeValidationError(res, { category_id: ['Section is not found.'] });
    }

    const link = await sequelize.transaction(async (transaction) => ResourceLink.create({
        ...fields,
        category_id: categoryId,
        position: await nextPosition(ResourceLink, { category_id: categoryId }, transaction)
    }, { transaction }));

    return res.json({
        success: true,
        data: link
    });
};

exports.getLink = async (req, res) => {
    return res.json({
        success: true,
        data: req.currentResourceLink
    });
};

exports.updateLink = async (req, res) => {
    if (!ensureCanManage(req, res)) return;

    const fields = pickFields(req.body, constants.FIELDS_TO_UPDATE.RESOURCE_LINK);
    const link = req.currentResourceLink;

    if (typeof fields.category_id !== 'undefined' && toCategoryId(fields.category_id) !== link.category_id) {
        const categoryId = await findCategoryId(fields.category_id);
        if (!categoryId) {
            return errors.makeValidationError(res, { category_id: ['Section is not found.'] });
        }

        fields.category_id = categoryId;
        fields.position = await nextPosition(ResourceLink, { category_id: categoryId });
    } else {
        delete fields.category_id;
    }

    await link.update(fields);
    await link.reload();

    return res.json({
        success: true,
        data: link
    });
};

exports.deleteLink = async (req, res) => {
    if (!ensureCanManage(req, res)) return;

    await req.currentResourceLink.destroy();

    return res.json({
        success: true,
        message: 'Link is deleted.'
    });
};
