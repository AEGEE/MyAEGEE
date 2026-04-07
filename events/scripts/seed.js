const fs = require('fs');
const path = require('path');
const moment = require('moment');

const { authenticate, close } = require('../lib/sequelize');
const logger = require('../lib/logger');
const {
    Application,
    Event
} = require('../models');

const seedStatePath = path.resolve(__dirname, '../state/.seed-executed-' + (process.env.NODE_ENV || 'development'));

const data = {};

function markSeedExecuted() {
    fs.mkdirSync(path.dirname(seedStatePath), { recursive: true });
    fs.closeSync(fs.openSync(seedStatePath, 'w'));
}

async function createEvents() {
    const events = [];

    events.publishedWithLongTitle = await Event.create({
        name: 'Published Event With A Long Title That Does Not Really Make Sense 2: The Sequel Event To A Long Tradition',
        url: 'published-long-title',
        description: 'This is a published event with a long title.\n## This is a markdown header\nAnd this is **highlighted**',
        application_starts: moment().subtract(2, 'weeks').toDate(),
        application_ends: moment().subtract(1, 'week').toDate(),
        starts: moment().add(2, 'weeks').toDate(),
        ends: moment().add(3, 'weeks').toDate(),
        fee: 50.00,
        optional_fee: 10.00,
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }, { body_id: 12, body_name: 'Network Commission' }],
        locations: [{ name: 'Location', position: { lat: 50.8503396, lng: 4.3517103 } }],
        type: 'nwm',
        status: 'published',
        organizers: [{ user_id: 1, first_name: 'Admin', last_name: 'Admin' }],
        questions: [{ description: 'Why do you want to participate?', type: 'text', required: false }],
        meals_per_day: 2,
        vegetarian: true,
        accommodation_type: 'none',
        budget: 'https://online-event.example.com',
        programme: 'https://online-event.example.com',
    });

    events.publishedSingleDayEvent = await Event.create({
        name: 'Published Single Day Event',
        url: 'published-single-day-event',
        description: 'This is a published event that only takes place during a single day.',
        application_starts: new Date(),
        application_ends: moment().add(1, 'week').toDate(),
        starts: moment().add(2, 'weeks').toDate(),
        ends: moment().add(2, 'weeks').add(1, 'hour').toDate(),
        fee: 50.00,
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        locations: [{ name: 'Location', position: { lat: 50.8503396, lng: 4.3517103 } }],
        type: 'conference',
        status: 'published',
        organizers: [{ user_id: 1, first_name: 'Admin', last_name: 'Admin' }],
        questions: [{ description: 'Why do you want to participate?', type: 'text', required: false }],
        meals_per_day: 2,
        accommodation_type: 'none',
        budget: 'https://online-event.example.com',
        programme: 'https://online-event.example.com',
        method: 'in person'
    });

    events.publishedEventWithoutFee = await Event.create({
        name: 'Published Event Without Fee',
        url: 'published-event-without-fee',
        description: 'This is a published event without a fee.',
        application_starts: moment().add(5, 'days').toDate(),
        application_ends: moment().add(1, 'week').toDate(),
        starts: moment().add(2, 'weeks').toDate(),
        ends: moment().add(3, 'weeks').toDate(),
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        locations: [{ name: 'Location', position: { lat: 50.8503396, lng: 4.3517103 } }],
        type: 'training',
        status: 'published',
        organizers: [{ user_id: 1, first_name: 'Admin', last_name: 'Admin' }],
        questions: [{ description: 'Why do you want to participate?', type: 'text', required: false }],
        accommodation_type: 'none',
        budget: 'https://online-event.example.com',
        programme: 'https://online-event.example.com',
    });

    events.publishedEventWithFee = await Event.create({
        name: 'Published Event',
        url: 'published-event',
        description: 'This is a published event.',
        application_starts: new Date(),
        application_ends: moment().add(1, 'week').toDate(),
        starts: moment().add(2, 'weeks').toDate(),
        ends: moment().add(3, 'weeks').toDate(),
        fee: 50.00,
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        locations: [{ name: 'Location', position: { lat: 50.8503396, lng: 4.3517103 } }],
        type: 'cultural',
        status: 'published',
        organizers: [{ user_id: 1, first_name: 'Admin', last_name: 'Admin' }],
        questions: [{ description: 'Why do you want to participate?', type: 'text', required: false }],
        meals_per_day: 2,
        accommodation_type: 'none',
        budget: 'https://online-event.example.com',
        programme: 'https://online-event.example.com',
    });

    events.publishedPastEvent = await Event.create({
        name: 'Published Past Event',
        url: 'published-past-event',
        description: 'This is a published event that took place in the past.',
        application_starts: moment().subtract(5, 'weeks').toDate(),
        application_ends: moment().subtract(4, 'weeks').toDate(),
        starts: moment().subtract(3, 'weeks').toDate(),
        ends: moment().subtract(2, 'weeks').toDate(),
        fee: 50.00,
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        locations: [{ name: 'Location', position: { lat: 50.8503396, lng: 4.3517103 } }],
        type: 'cultural',
        status: 'published',
        organizers: [{ user_id: 1, first_name: 'Admin', last_name: 'Admin' }],
        questions: [{ description: 'Why do you want to participate?', type: 'text', required: false }],
        meals_per_day: 2,
        accommodation_type: 'none',
        budget: 'https://online-event.example.com',
        programme: 'https://online-event.example.com',
    });

    events.draftEvent = await Event.create({
        name: 'Draft Event',
        url: 'draft-event',
        description: 'This is a draft event.',
        application_starts: new Date(),
        application_ends: moment().add(1, 'week').toDate(),
        starts: moment().add(2, 'weeks').toDate(),
        ends: moment().add(3, 'weeks').toDate(),
        fee: 50.00,
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        locations: [{ name: 'Location', position: { lat: 50.8503396, lng: 4.3517103 } }],
        type: 'cultural',
        status: 'draft',
        organizers: [{ user_id: 1, first_name: 'Admin', last_name: 'Admin' }],
        questions: [{ description: 'Why do you want to participate?', type: 'text', required: false }],
        meals_per_day: 2,
        accommodation_type: 'none',
    });

    events.submittedEvent = await Event.create({
        name: 'Submitted Event',
        url: 'submitted-event',
        description: 'This is a submitted event.',
        application_starts: new Date(),
        application_ends: moment().add(1, 'week').toDate(),
        starts: moment().add(2, 'weeks').toDate(),
        ends: moment().add(3, 'weeks').toDate(),
        fee: 50.00,
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        locations: [{ name: 'Location', position: { lat: 50.8503396, lng: 4.3517103 } }],
        type: 'cultural',
        status: 'submitted',
        organizers: [{ user_id: 1, first_name: 'Admin', last_name: 'Admin' }],
        questions: [{ description: 'Why do you want to participate?', type: 'text', required: false }],
        meals_per_day: 2,
        accommodation_type: 'none',
        budget: 'https://online-event.example.com',
        programme: 'https://online-event.example.com',
    });

    events.publishedOnlineEvent = await Event.create({
        name: 'Online Event',
        url: 'published-online-event',
        description: 'This is a published online event.',
        application_starts: new Date(),
        application_ends: moment().add(1, 'week').toDate(),
        starts: moment().add(2, 'weeks').toDate(),
        ends: moment().add(2, 'weeks').add(1, 'hour').toDate(),
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        type: 'conference',
        status: 'published',
        organizers: [{ user_id: 1, first_name: 'Admin', last_name: 'Admin' }],
        programme: 'https://online-event.example.com',
        method: 'online'
    });

    events.publishedOnlineEventWithoutApplications = await Event.create({
        name: 'Online Event without applications',
        url: 'published-online-event-without-applications',
        description: 'This is a published online event without applications.',
        application_starts: new Date(),
        application_ends: moment().add(1, 'week').toDate(),
        starts: moment().add(2, 'weeks').toDate(),
        ends: moment().add(2, 'weeks').add(1, 'hour').toDate(),
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        type: 'conference',
        status: 'published',
        organizers: [{ user_id: 1, first_name: 'Admin', last_name: 'Admin' }],
        programme: 'https://online-event.example.com',
        method: 'online',
        has_applications: false
    });

    return events;
}

async function createApplications() {
    const applications = [];

    applications.first = await Application.create({
        user_id: 2,
        event_id: data.events.publishedEventWithFee.id,
        body_id: 1,
        first_name: 'A',
        last_name: 'Member',
        body_name: 'AEGEE-Antenna',
        status: 'pending',
        confirmed: false,
        attended: false,
        answers: ['Because I want to learn new things.'],
        agreed_to_privacy_policy: true,
    });

    return applications;
}

if (fs.existsSync(seedStatePath)) {
    logger.info('[seeds         ]: Seed was executed already, no need to run it again.');
    process.exit(0);
}

if (process.env.NODE_ENV === 'production') {
    logger.error('Not running seeds in production.');
    process.exit(0);
}

authenticate().then(async () => {
    logger.info('[seeds         ]: DB connected');

    const existingEvents = await Event.count();
    if (existingEvents > 0) {
        logger.info('[seeds         ]: Seed data already exists, marking seed as executed.');
        markSeedExecuted();
        await close();
        process.exit(0);
    }

    logger.info('[seeds         ]: Create events');
    data.events = await createEvents();

    logger.info('[seeds         ]: Create applications');
    data.applications = await createApplications();

    markSeedExecuted();

    await close();
}).catch((err) => {
    logger.error(`[seeds         ]: Seed creation error: ${err}`);
    process.exit(1);
});
