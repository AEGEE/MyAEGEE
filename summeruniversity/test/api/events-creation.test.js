const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');
const user = require('../assets/oms-core-valid.json').data;

describe('Events creation', () => {
    let mails;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mails = mock.captureMails(mock.mockAll().omsMailerStub);
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const createEvent = (body) => request({ path: '/', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body });

    test('should return 401 if the user is not authenticated', async () => {
        mock.mockAll({ core: { unauthorized: true }, mainPermissions: { unauthorized: true }, approvePermissions: { unauthorized: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(await Event.count()).toEqual(0);
    });

    test('should return 403 if the user has no create permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('You are not allowed to create summer university events.');
        expect(await Event.count()).toEqual(0);
    });

    test('should return 403 if the user is not one of the organizers', async () => {
        const res = await createEvent(generator.generateEventBody({ organizers: generator.generateOrganizers(9999) }));

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('User creating the event should be one of the organizers.');
    });

    test('should return 403 if no organizers are given', async () => {
        const body = generator.generateEventBody();
        delete body.organizers;

        const res = await createEvent(body);

        expect(res.statusCode).toEqual(403);
    });

    describe('type and fee permissions', () => {
        test('should not let a creator without edit:su_type create a pilot', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:create:summeruniversity'] } });

            const res = await createEvent(generator.generateEventBody({ type: 'pilot' }));

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(await Event.count()).toEqual(0);
        });

        test('should let a creator with edit:su_type create a pilot', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:create:summeruniversity', 'global:edit:su_type'] } });

            const res = await createEvent(generator.generateEventBody({ type: 'pilot' }));

            expect(res.statusCode).toEqual(201);
            expect(res.body.data.type).toEqual('pilot');
        });

        test('should let a creator without edit:su_type create a regular SU', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:create:summeruniversity'] } });

            const res = await createEvent(generator.generateEventBody({ type: 'regular' }));

            expect(res.statusCode).toEqual(201);
            expect(res.body.data.type).toEqual('regular');
        });

        test('should let a creator without edit:su_fee set the fee', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:create:summeruniversity'] } });

            const res = await createEvent(generator.generateEventBody({ fee: 77 }));

            expect(res.statusCode).toEqual(201);
            const event = await Event.findByPk(res.body.data.id);
            expect(Number(event.fee)).toEqual(77);
        });

        test.each([
            ['an array', ['pilot']],
            ['an object', { type: 'pilot' }],
            ['a number', 1],
            ['an unknown type', 'garbage']
        ])('should answer 422 for a type that is %s, also without edit:su_type', async (_name, type) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:create:summeruniversity'] } });

            const res = await createEvent(generator.generateEventBody({ type }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('type');
            expect(await Event.count()).toEqual(0);
        });

        test.each([
            ['null', null],
            ['empty', ''],
            ['not a number', 'abc']
        ])('should answer 422 for a fee that is %s', async (_name, fee) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:create:summeruniversity'] } });

            const res = await createEvent(generator.generateEventBody({ fee }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('fee');
            expect(await Event.count()).toEqual(0);
        });
    });

    test.each([
        ['theme_category', 'sports'],
        ['pax_confirmation', 'payment'],
        ['course_level', 'beginner']
    ])('should answer 422 for a %s that is not a string', async (field, value) => {
        for (const sent of [[value], { [field]: value }, 1]) {
            const res = await createEvent(generator.generateEventBody({ [field]: sent }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty(field);
        }
        expect(await Event.count()).toEqual(0);
    });

    test('should create an event and notify the organizers and SUCT', async () => {
        const body = generator.generateEventBody({ name: 'Brand new SU', season: 2027, url: 'brand-new-su' });

        const res = await createEvent(body);

        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toEqual(true);
        expect(res.body.message).toEqual('Event successfully created');
        expect(res.body.data.name).toEqual('Brand new SU');
        expect(res.body.data.status).toEqual('first submission');
        expect(res.body.data.published).toEqual('none');
        expect(res.body.data.season).toEqual(2027);

        const event = await Event.findByPk(res.body.data.id);
        expect(event.name).toEqual('Brand new SU');
        expect(event.url).toEqual('brand-new-su');
        expect(event.status).toEqual('first submission');

        expect(mails.map((mail) => mail.template)).toEqual([
            'summeruniversity_event_created.html',
            'summeruniversity_submitted.html'
        ]);
        expect(mails[0].to).toEqual(Array(4).fill(user.notification_email));
        expect(mails[1].to).toEqual(['suct@aegee.eu']);
    });

    test('should default the season to the active season', async () => {
        await generator.createSeason({ year: 2027 });
        await generator.activateSeason(2027);
        const body = generator.generateEventBody();
        delete body.season;

        const res = await createEvent(body);

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.season).toEqual(2027);
    });

    test('should use the active season if the user cannot manage the event type', async () => {
        mock.mockAll({ mainPermissions: { permissions: ['global:create:summeruniversity', 'global:manage_summeruniversity:pilot'] } });

        const res = await createEvent(generator.generateEventBody({ season: 2025, type: 'regular' }));

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.season).toEqual(2026);
    });

    test('should leave the season empty if no season is active', async () => {
        await generator.deactivateSeasons();
        const body = generator.generateEventBody();
        delete body.season;

        const res = await createEvent(body);

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.season).toEqual(null);
    });

    test('should ignore id, image, deleted, published and status from the body', async () => {
        const body = generator.generateEventBody();
        body.id = 1337;
        body.image = 'hacked.png';
        body.deleted = true;
        body.published = 'full';
        body.status = 'second approval';

        const res = await createEvent(body);

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.id).not.toEqual(1337);

        const event = await Event.findByPk(res.body.data.id);
        expect(event.image).toEqual(null);
        expect(event.deleted).toEqual(false);
        expect(event.published).toEqual('none');
        expect(event.status).toEqual('first submission');
    });

    test('should ignore the application period, open call and participant counters from the body', async () => {
        const body = generator.generateEventBody({ max_participants: 25 });
        body.application_starts = generator.daysFromNow(1);
        body.application_ends = generator.daysFromNow(10);
        body.open_call = true;
        body.accepted_participants = 20;
        body.available_spots = 5;

        const res = await createEvent(body);

        expect(res.statusCode).toEqual(201);

        const event = await Event.findByPk(res.body.data.id);
        expect(event.application_starts).toEqual(null);
        expect(event.application_ends).toEqual(null);
        expect(event.open_call).toEqual(false);
        expect(event.accepted_participants).toEqual(null);
        expect(event.max_participants).toEqual(25);
    });

    test('should fetch the organizing bodies and cooperation bodies names from core', async () => {
        const body = generator.generateEventBody({
            organizing_bodies: [{ body_id: 34, body_name: 'wrong name' }],
            cooperation: [{ body_id: 34 }]
        });

        const res = await createEvent(body);

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.organizing_bodies).toEqual([{ body_id: 34, body_name: 'AEGEE-Alicante' }]);
        expect(res.body.data.cooperation).toEqual([{ body_id: 34, body_name: 'AEGEE-Alicante' }]);
    });

    test.each([
        ['organizing_bodies', 'notFound'],
        ['organizing_bodies', 'forbidden'],
        ['cooperation', 'notFound']
    ])('should return 422 if a body in %s cannot be fetched (%s)', async (field, failure) => {
        mock.mockAll({ body: { [failure]: true } });

        const res = await createEvent(generator.generateEventBody({ organizing_bodies: [{ body_id: 4242 }], cooperation: [{ body_id: 4243 }] }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty(field);
        expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
        expect(await Event.count()).toEqual(0);
    });

    test('should return 422 if the organizing bodies are malformed', async () => {
        const res = await createEvent(generator.generateEventBody({ organizing_bodies: ['not an object'] }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('organizing_bodies');
    });

    test('should return 422 if there are no organizing bodies', async () => {
        const res = await createEvent(generator.generateEventBody({ organizing_bodies: [] }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.organizing_bodies).toEqual(['At least 1 organizing body should be presented.']);
    });

    test('should return 422 if the cooperation bodies are malformed', async () => {
        const res = await createEvent(generator.generateEventBody({ cooperation: [{ body_id: 'abc' }] }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.cooperation).toEqual(['body_id should be an integer.']);
    });

    test.each([
        ['name', { name: '' }, 'Event name should be set.'],
        ['description', { description: '' }, 'Event description should be set.'],
        ['email', { email: 'not-an-email' }, 'Given email is not valid.'],
        ['url', { url: 'not a valid url!' }, 'Event URL should only contain numbers, letters and dashes.'],
        ['url', { url: '1234' }, 'Event URL should have at least 1 letter.'],
        ['ends', { starts: generator.daysFromNow(70), ends: generator.daysFromNow(60) }, 'Event cannot start after or at the same time it ends.'],
        ['fee', { fee: -1 }, 'Event fee cannot be negative'],
        ['optional_fee', { optional_fee: 51 }, 'Optional fee cannot be more than 50 euros.'],
        ['type', { type: 'nwm' }, 'SU type should be one of these: regular, pilot.'],
        ['theme_category', { theme_category: 'unknown' }, 'Theme should be one of these: arts_creativity, sustainability, local_culture, sports, social_equity, political_activism, mental_health, leisure, personal_development, volunteering.'],
        ['theme', { theme: '' }, 'Theme explanation should be set.'],
        ['theme_implementation', { theme_implementation: '' }, 'Explanation of theme implementation should be set.'],
        ['programme_suct', { programme_suct: 'not a url' }, 'The link should be a valid URL starting with http:// or https://.'],
        ['website', { website: 'not a url' }, 'The link should be a valid URL starting with http:// or https://.'],
        ['website', { website: 'ftp://example.org' }, 'The link should be a valid URL starting with http:// or https://.'],
        ['budget', { budget: 'ftp://example.org/budget' }, 'The link should be a valid URL starting with http:// or https://.'],
        ['programme_suct', { programme_suct: 'ftp://example.org/programme' }, 'The link should be a valid URL starting with http:// or https://.'],
        ['social_media', { social_media: 'https://www.instagram.com/aegee' }, 'Social media should be a list of links.'],
        ['social_media', { social_media: [1, 2, 3, 4].map((index) => ({ name: '', description: `https://example.org/${index}` })) }, 'At most 3 social media links can be set.'],
        ['social_media', { social_media: [null] }, 'Every social media entry should have a link.'],
        ['social_media', { social_media: [{ name: 'Instagram' }] }, 'Every social media entry should have a link.'],
        ['social_media', { social_media: [{ name: '', description: '  ' }] }, 'Every social media entry should have a link.'],
        ['social_media', { social_media: [{ name: '', description: 'www.facebook.com/aegee' }] }, 'The link should be a valid URL starting with http:// or https://.'],
        // eslint-disable-next-line no-script-url
        ['social_media', { social_media: [{ name: '', description: 'javascript:alert(1)' }] }, 'The link should be a valid URL starting with http:// or https://.'],
        ['social_media', { social_media: [{ name: '', description: 'https://exa mple.org' }] }, 'The link should be a valid URL starting with http:// or https://.'],
        ['social_media', { social_media: [{ name: '', description: 'java\nscript://%0aalert(1)' }] }, 'The link should be a valid URL starting with http:// or https://.'],
        ['accommodation_type', { accommodation_type: '' }, 'The type of accommodation should be set.'],
        ['agreed_to_su_terms', { agreed_to_su_terms: false }, 'You should agree to the SU terms.'],
        ['max_participants', { max_participants: -5 }, 'Max amount of participants cannot be negative'],
        ['questions', { questions: 'not an array' }, 'Event questions should be a list.'],
        ['course_level', { course_level: 'expert' }, 'SU course level should be one of these: beginner, intermediate, advanced.'],
        ['locations', { locations: [] }, null],
        ['organizers', { organizers: [{ user_id: user.id, role: 'main_coordinator' }] }, null],
        ['organizers', { organizers: 'abc' }, null],
        ['organizers', { organizers: [...generator.generateOrganizers().slice(0, 3), { user_id: 1004 }] }, null],
        ['email', { email: '' }, 'Email should be given.'],
        ['starts', { starts: 'garbage' }, 'Event start date should be valid.'],
        ['fee', { fee: 'abc' }, 'Event fee should be valid.'],
        ['optional_fee', { optional_fee: -1 }, 'Optional fee cannot be negative'],
        ['organizing_bodies', { organizing_bodies: 'abc' }, 'Organizing bodies should be an array.'],
        ['organizing_bodies', { organizing_bodies: [{ body_id: 'x' }] }, 'body_id should be an integer.'],
        ['cooperation', { cooperation: 'abc' }, 'Cooperation should be an array.'],
        ['cooperation', { cooperation: [5] }, 'Body is malformed.'],
        ['locations', { locations: [{ name: 'Alicante', position: { lat: 1 } }] }, null],
        ['learning_objectives', { learning_objectives: [] }, 'Learning objectives should be set.'],
        ['pax_confirmation', { pax_confirmation: 'x' }, 'Pax confirmation should be one of these: no_confirmation, payment, ticket, payment_or_ticket, payment_and_ticket.'],
    ])('should return 422 on an invalid %s', async (field, overrides, message) => {
        const res = await createEvent(generator.generateEventBody(overrides));

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty(field);
        if (message) {
            expect(res.body.errors[field]).toContain(message);
        }
        expect(await Event.count()).toEqual(0);
        expect(mails.length).toEqual(0);
    });

    test.each(['name', 'video', 'accommodation_type'])('should return 422 if %s is longer than its column (255 characters)', async (field) => {
        const res = await createEvent(generator.generateEventBody({ [field]: 'x'.repeat(256) }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors[field]).toContain('This text should be at most 255 characters long.');
        expect(await Event.count()).toEqual(0);
    });

    test('should answer with the stored values, not the ones sent', async () => {
        const res = await createEvent(generator.generateEventBody({ max_participants: '20' }));

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.max_participants).toEqual(20);
    });

    test('should return 422 with both messages if the email is empty', async () => {
        const res = await createEvent(generator.generateEventBody({ email: '' }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.email).toEqual(['Email should be given.', 'Given email is not valid.']);
    });

    test('should return 422 if the programme for SUCT is missing', async () => {
        const body = generator.generateEventBody();
        delete body.programme_suct;

        const res = await createEvent(body);

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('programme_suct');
        expect(await Event.count()).toEqual(0);
    });

    test.each([
        ['organizing_bodies', 'body_name should be a string.', 123],
        ['organizing_bodies', 'body_name should not be empty.', ' '],
        ['cooperation', 'body_name should be a string.', 123],
        ['cooperation', 'body_name should not be empty.', ' ']
    ])('should return 422 on %s if core gives a body name that is not usable (%s)', async (field, message, name) => {
        mails = mock.captureMails(mock.mockAll({ body: { data: { id: 34, name } } }).omsMailerStub);
        // Every body is fetched from core, so the organizing body gets the same name.
        const res = await createEvent(generator.generateEventBody({ cooperation: [{ body_id: 34 }] }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors[field]).toEqual([message]);
        expect(await Event.count()).toEqual(0);
    });

    test('should currently return 500 if a cooperation body is null', async () => {
        const res = await createEvent(generator.generateEventBody({ cooperation: [null] }));

        expect(res.statusCode).toEqual(500);
        expect(await Event.count()).toEqual(0);
    });

    test('should return 422 if a manager gives a season that is not a number', async () => {
        const res = await createEvent(generator.generateEventBody({ season: 'abc' }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.season).toEqual(['Season should be a year.']);
        expect(await Event.count()).toEqual(0);
    });

    test('should let a manager choose a season that has no season record', async () => {
        const res = await createEvent(generator.generateEventBody({ season: 1999 }));

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.season).toEqual(1999);
    });

    test('should store a created_at given in the body', async () => {
        const res = await createEvent(generator.generateEventBody({ created_at: '2000-01-01T00:00:00.000Z' }));

        expect(res.statusCode).toEqual(201);
        const event = await Event.findByPk(res.body.data.id);
        expect(event.created_at.toISOString()).toEqual('2000-01-01T00:00:00.000Z');
    });

    test('should accept social media links', async () => {
        const socialMedia = [
            { name: '', description: 'https://www.instagram.com/aegee' },
            { name: '', description: 'https://www.facebook.com/aegee' }
        ];
        const res = await createEvent(generator.generateEventBody({ social_media: socialMedia }));

        expect(res.statusCode).toEqual(201);
        const event = await Event.findByPk(res.body.data.id);
        expect(event.social_media).toEqual(socialMedia);
    });

    test('should return 422 if the url is already taken', async () => {
        await generator.createEvent({ url: 'taken-url' });

        const res = await createEvent(generator.generateEventBody({ url: 'taken-url' }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('url');
        expect(await Event.count()).toEqual(1);
    });

    test('should return 500 and not create the event if the mailer fails', async () => {
        mock.mockAll({ mailer: { unsuccessfulResponse: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Unsuccessful response from mailer');
        expect(await Event.count()).toEqual(0);
    });

    test('should return 500 and not create the event if the mailer returns garbage', async () => {
        mock.mockAll({ mailer: { badResponse: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Malformed response from mailer');
        expect(await Event.count()).toEqual(0);
    });

    test('should return 500 if fetching a body from core fails', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Error fetching body');
        expect(await Event.count()).toEqual(0);
    });

    test('should return 500 if core returns garbage for a body', async () => {
        mock.mockAll({ body: { badResponse: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Malformed response when fetching body');
    });

    test('should return 500 and not create the event if the core login fails', async () => {
        mock.mockAll({ login: { unsuccessfulResponse: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Error fetching auth request');
        expect(await Event.count()).toEqual(0);
    });

    test('should return 500 if core returns garbage on login', async () => {
        mock.mockAll({ login: { badResponse: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Malformed response when fetching auth request');
    });

    test.each([
        ['the core login', { login: { emptyResponse: true } }, 'Malformed response when fetching auth request: null'],
        ['an organizer', { member: { emptyResponse: true } }, 'Malformed response when fetching user: null'],
        ['a body', { body: { emptyResponse: true } }, 'Malformed response when fetching body: null']
    ])('should return 500 naming the malformed response if core returns an empty body for %s', async (_, options, message) => {
        mails = mock.captureMails(mock.mockAll(options).omsMailerStub);

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toEqual(message);
        expect(await Event.count()).toEqual(0);
    });

    test('should return 500 and not create the event if fetching an organizer fails', async () => {
        mock.mockAll({ member: { unsuccessfulResponse: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Error fetching user');
        expect(await Event.count()).toEqual(0);
    });

    test('should return 500 if core returns garbage for an organizer', async () => {
        mock.mockAll({ member: { badResponse: true } });

        const res = await createEvent(generator.generateEventBody());

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Malformed response when fetching user');
    });
});
