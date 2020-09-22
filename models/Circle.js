const { Sequelize, sequelize } = require('../lib/sequelize');

const Circle = sequelize.define('circle', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Name should be set.' },
        }
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Description should be set.' },
        },
    }
}, {
    underscored: true,
    tableName: 'circles',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

Circle.beforeValidate(async (circle) => {
    // skipping these fields if they are unset, will catch it later.
    if (typeof circle.name === 'string') circle.name = circle.name.trim();
    if (typeof circle.description === 'string') circle.description = circle.description.trim();
});

// Checking if there isn't a loop inside circles (so no circle1 -> circle2 -> circle1).
Circle.throwIfAnyLoops = async function throwIfAnyLoops(transaction) {
    // Firstly, loading all bound circles.
    const circles = await Circle.findAll({ transaction });
    const boundCircles = circles.filter((circle) => circle.parent_circle_id !== null);

    // Secondly, creating a map of circles visited.
    let visibleCircles = {};

    // Then, defining a function that we'll call recursively.
    const markCircleAsVisible = (circle) => {
        // means that we'be been there before
        if (visibleCircles[circle.id]) {
            throw new Error(`There's a loop in circles, check ID ${circle.id}`);
        }

        // now we haven't been here before, let's mark this circle as visited
        // and move on to its parent circle
        visibleCircles[circle.id] = true;
        if (!circle.parent_circle_id) {
            return;
        }

        const parentCircle = circles.find((c) => c.id === circle.parent_circle_id);
        markCircleAsVisible(parentCircle);
    };

    // Lastly, call this function for all circles.
    for (const circle of boundCircles) {
        markCircleAsVisible(circle);

        // Only counting loops within one chain.
        visibleCircles = {};
    }
};

module.exports = Circle;
