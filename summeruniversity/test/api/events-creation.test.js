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

    test('should default the season to 2026', async () => {
        const body = generator.generateEventBody();
        delete body.season;

        const res = await createEvent(body);

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.season).toEqual(2026);
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
        ['type', { type: 'nwm' }, 'SU type should be one of these: normal, pilot.'],
        ['theme_category', { theme_category: 'unknown' }, null],
        ['theme', { theme: '' }, 'Theme explanation should be set.'],
        ['theme_implementation', { theme_implementation: '' }, 'Explanation of theme implementation should be set.'],
        ['programme_suct', { programme_suct: 'not a url' }, 'The provided link is not a valid URL.'],
        ['website', { website: 'not a url' }, 'The provided link is not a valid URL.'],
        ['social_media', { social_media: 'https://www.instagram.com/aegee' }, 'Social media should be a list of links.'],
        ['social_media', { social_media: [1, 2, 3, 4].map((index) => ({ name: '', description: `https://example.org/${index}` })) }, 'At most 3 social media links can be set.'],
        ['social_media', { social_media: [null] }, 'Every social media entry should have a link.'],
        ['social_media', { social_media: [{ name: 'Instagram' }] }, 'Every social media entry should have a link.'],
        ['social_media', { social_media: [{ name: '', description: '  ' }] }, 'Every social media entry should have a link.'],
        // eslint-disable-next-line no-script-url
        ['social_media', { social_media: [{ name: '', description: 'javascript:alert(1)' }] }, 'The link should start with http:// or https://.'],
        ['social_media', { social_media: [{ name: '', description: 'https://exa mple.org' }] }, 'The provided link is not a valid URL.'],
        ['social_media', { social_media: [{ name: '', description: 'java\nscript://%0aalert(1)' }] }, 'The provided link is not a valid URL.'],
        ['accommodation_type', { accommodation_type: '' }, 'The type of accommodation should be set.'],
        ['agreed_to_su_terms', { agreed_to_su_terms: false }, 'You should agree to the SU terms.'],
        ['max_participants', { max_participants: -5 }, 'Max amount of participants cannot be negative'],
        ['questions', { questions: 'not an array' }, 'Event questions should be an array of strings.'],
        ['course_level', { course_level: 'expert' }, 'SU course level should be one of these: beginner, intermediate, advanced.'],
        ['application_ends', { application_starts: generator.daysFromNow(10), application_ends: generator.daysFromNow(5) }, 'Application period cannot end before or at the same time it starts.'],
        ['locations', { locations: [] }, null],
        ['organizers', { organizers: [{ user_id: user.id, role: 'main_coordinator' }] }, null],
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

    test('should accept social media links', async () => {
        const socialMedia = [
            { name: '', description: 'https://www.instagram.com/aegee' },
            { name: '', description: 'www.facebook.com/aegee' }
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
