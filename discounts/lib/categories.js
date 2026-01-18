const { Category } = require('../models');
const errors = require('./errors');
const helpers = require('./helpers');

exports.createCategory = async (req, res) => {
    if (!req.permissions.manage_discounts) {
        return errors.makeForbiddenError(res, 'You are not allowed to create integrations.');
    }

    const category = await Category.create(req.body);

    return res.json({
        success: true,
        data: category
    });
};

exports.listAllCategories = async (req, res) => {
    const categories = await Category.findAll({});

    return res.json({
        success: true,
        data: categories
    });
};

exports.findCategory = async (req, res, next) => {
    const isNumber = helpers.isNumber(req.params.category_id);

    if (!isNumber) {
        return errors.makeBadRequestError(res, 'The category ID is not a number.');
    }

    const category = await Category.findOne({ where: { id: Number(req.params.category_id) } });

    if (!category) {
        return errors.makeNotFoundError(res, 'The category is not found.');
    }

    req.category = category;
    return next();
};

exports.getCategory = async (req, res) => {
    return res.json({
        success: true,
        data: req.category
    });
};

exports.updateCategory = async (req, res) => {
    if (!req.permissions.manage_discounts) {
        return errors.makeForbiddenError(res, 'You are not allowed to update category.');
    }

    await req.category.update(req.body);

    return res.json({
        success: true,
        data: req.category
    });
};

exports.deleteCategory = async (req, res) => {
    if (!req.permissions.manage_discounts) {
        return errors.makeForbiddenError(res, 'You are not allowed to delete category.');
    }

    await req.category.destroy();

    return res.json({
        success: true,
        data: req.category
    });
};
