const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { at, fixedDates, BEFORE_EVERYTHING } = require('../scripts/fixed-event');
const { Event, Image } = require('../../models');

describe('Events editing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should disallow event editing if user has no rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                name: 'Not updated name.'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findOne({ where: { id: event.id } });
        expect(eventFromDb.name).not.toEqual('Not updated name.');
    });

    test('should allow editing if everything is okay', async () => {
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                name: 'Not updated name.'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual('Not updated name.');

        const eventFromDb = await Event.findOne({ where: { id: event.id } });
        expect(eventFromDb.name).toEqual('Not updated name.');
    });

    test('should return 404 if event is not found', async () => {
        const res = await request({
            path: '/events/notexistant',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                name: 'Not updated name.'
            }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should return validation error if something\'s wrong', async () => {
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                name: '',
                description: ''
            }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
        expect(res.body.errors).toHaveProperty('description');
    });

    test('should set application_status_revealed_at when editing after publication date', async () => {
        const event = await generator.createEvent({
            application_status_revealed_at: null
        });
        await event.update({ participants_list_publish_deadline: moment().subtract(1, 'day').toDate() });

        const res = await request({
            path: '/events/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                name: 'Updated event name'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.application_status_revealed_at).toBeTruthy();

        const eventFromDb = await Event.findOne({ where: { id: event.id } });
        expect(eventFromDb.application_status_revealed_at).toBeTruthy();
    });

    test.each([
        // eslint-disable-next-line no-script-url
        'javascript:alert(1)',
        'ftp://example.org/booklet',
        'not a url'
    ])('should reject %j as the booklet folder', async (link) => {
        const event = await generator.createEvent({ booklet_folder: 'https://drive.google.com/booklet' });

        const res = await request({
            path: '/events/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { booklet_folder: link }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('booklet_folder');

        const eventFromDb = await Event.findByPk(event.id);
        expect(eventFromDb.booklet_folder).toEqual('https://drive.google.com/booklet');
    });

    describe('who may edit an event', () => {
        test.each(['agora', 'epm', 'spm'])('should let the holder of global:manage_event:%s alone edit such an event', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:' + type] } });
            const event = await generator.createEvent({ type });

            const res = await request({
                path: '/events/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { name: 'A new name' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.name).toEqual('A new name');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.name).toEqual('A new name');
        });

        test.each([
            ['agora', ['global:manage_event:epm', 'global:manage_event:spm']],
            ['epm', ['global:manage_event:agora', 'global:manage_event:spm']],
            ['spm', ['global:manage_event:agora', 'global:manage_event:epm']],
            ['agora', ['global:manage_applications:agora', 'global:manage_incoming:agora', 'global:approve_members:agora']]
        ])('should refuse the edit of a published %s from somebody with %j', async (type, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });
            const event = await generator.createEvent({ type, name: 'The old name' });

            const res = await request({
                path: '/events/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { name: 'A new name' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('You are not allowed to update events of this type.');
            expect(res.body).not.toHaveProperty('data');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.name).toEqual('The old name');
        });

        test('should let its manager edit a draft', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:epm'] } });
            const event = await generator.createEvent({ type: 'epm', status: 'draft' });

            const res = await request({
                path: '/events/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { name: 'A new name' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('draft');
            expect((await Event.findByPk(event.id)).name).toEqual('A new name');
        });
    });

    describe('what the body cannot change', () => {
        test.each([
            ['the type', { type: 'agora' }, 'type', 'epm'],
            ['the status', { status: 'published' }, 'status', 'draft'],
            ['the id', { id: 424242 }, 'id', null]
        ])('should not change %s', async (description, body, field, expected) => {
            const event = await generator.createEvent({ type: 'epm', status: 'draft' });

            const res = await request({
                path: '/events/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { ...body, name: 'A new name' }
            });

            // The rest of the edit is stored.
            expect(res.statusCode).toEqual(200);
            expect(res.body.data.name).toEqual('A new name');
            expect(res.body.data[field]).toEqual(expected === null ? event.id : expected);

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.name).toEqual('A new name');
            expect(eventFromDb[field]).toEqual(expected === null ? event.id : expected);
            expect(eventFromDb.publication_date).toEqual(null);
            expect(await Event.count()).toEqual(1);
        });

        test('should not change the image', async () => {
            const image = await Image.create({ user_id: 1337, file_name: 'own.png', file_folder: 'test' });
            const otherImage = await Image.create({ user_id: 1337, file_name: 'other.png', file_folder: 'test' });
            const event = await generator.createEvent({ type: 'epm', image_id: image.id });

            const res = await request({
                path: '/events/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { image_id: otherImage.id }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.image_id).toEqual(image.id);
            expect(res.body.data.image.file_name).toEqual('own.png');
            expect((await Event.findByPk(event.id)).image_id).toEqual(image.id);

            // Images are not removed by generator.clearAll().
            await event.update({ image_id: null });
            await Image.destroy({ where: { id: [image.id, otherImage.id] }, hooks: false });
        });

        test('should not take application_status_revealed_at from the body', async () => {
            tk.freeze(BEFORE_EVERYTHING);
            const event = await generator.createEvent({ type: 'epm', ...fixedDates() });

            const res = await request({
                path: '/events/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { application_status_revealed_at: new Date('2020-01-01T00:00:00.000Z') }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_status_revealed_at).toEqual(null);
            expect((await Event.findByPk(event.id)).application_status_revealed_at).toEqual(null);
        });
    });

    describe('validation', () => {
        test.each([
            ['a negative fee', 'fee', { fee: -1 }],
            ['no questions', 'questions', { questions: [] }],
            ['a url of digits only', 'url', { url: '2030' }],
            ['a url with a space', 'url', { url: 'spring agora' }],
            ['the end at the moment of the start', 'ends', { ends: at('starts') }],
            ['the board approve deadline at the moment the event starts', 'board_approve_deadline', { board_approve_deadline: at('starts') }],
            ['the participants list deadline at the moment the event starts', 'participants_list_publish_deadline', { participants_list_publish_deadline: at('starts') }]
        ])('should refuse %s and leave the event as it was', async (description, field, body) => {
            const event = await generator.createEvent({ type: 'epm', name: 'The old name', ...fixedDates() });

            const res = await request({
                path: '/events/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { ...body, name: 'A new name' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(Object.keys(res.body.errors)).toEqual([field]);

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.name).toEqual('The old name');
            expect(eventFromDb[field]).toEqual(event[field]);
        });

        test('should refuse the url of another event, whatever its case', async () => {
            await generator.createEvent({ url: 'spring-agora' });
            const event = await generator.createEvent({ url: 'autumn-agora' });

            const res = await request({
                path: '/events/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { url: 'Spring-Agora' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('url');
            expect((await Event.findByPk(event.id)).url).toEqual('autumn-agora');
        });

        test('should store a url in lower case', async () => {
            const event = await generator.createEvent({ url: 'autumn-agora' });

            const res = await request({
                path: '/events/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { url: 'Autumn-Agora-2030' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.url).toEqual('autumn-agora-2030');
            expect((await Event.findByPk(event.id)).url).toEqual('autumn-agora-2030');
        });
    });

    // The statuses of the applications count as revealed from the participants list deadline
    // on. The first edit at or after that deadline records the moment.
    describe('application_status_revealed_at', () => {
        const edit = (event, body = { name: 'A new name' }) => request({
            path: '/events/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        test('should stay empty when the event is edited 1 ms before the participants list deadline', async () => {
            const event = await generator.createEvent({ type: 'epm', ...fixedDates() });
            tk.freeze(at('participants_list_publish_deadline', -1));

            const res = await edit(event);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_status_revealed_at).toEqual(null);
            expect((await Event.findByPk(event.id)).application_status_revealed_at).toEqual(null);
        });

        test.each([
            ['exactly at the participants list deadline (inclusive)', 0],
            ['1 ms after the participants list deadline', 1]
        ])('should be set to the moment of the edit when the event is edited %s', async (description, offset) => {
            const event = await generator.createEvent({ type: 'epm', ...fixedDates() });
            const now = at('participants_list_publish_deadline', offset);
            tk.freeze(now);

            const res = await edit(event);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_status_revealed_at).toEqual(now.toISOString());
            expect((await Event.findByPk(event.id)).application_status_revealed_at).toEqual(now);
        });

        test('should keep the moment of the first edit after the deadline', async () => {
            const event = await generator.createEvent({ type: 'epm', ...fixedDates() });
            const firstEdit = at('participants_list_publish_deadline', 1000);
            tk.freeze(firstEdit);
            await edit(event);

            tk.freeze(at('participants_list_publish_deadline', 5000));
            const res = await edit(event, { name: 'Another name' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_status_revealed_at).toEqual(firstEdit.toISOString());
            expect((await Event.findByPk(event.id)).application_status_revealed_at).toEqual(firstEdit);
        });

        // The deadline that counts is the stored one, not the one in the edit itself.
        test('should not be set by the edit that moves the deadline into the past', async () => {
            const event = await generator.createEvent({ type: 'epm', ...fixedDates() });
            tk.freeze(at('participants_list_publish_deadline', -1000));

            const res = await edit(event, { participants_list_publish_deadline: at('participants_list_publish_deadline', -2000) });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_status_revealed_at).toEqual(null);

            // The next edit records it.
            const second = await edit(event);
            expect(second.body.data.application_status_revealed_at).toEqual(at('participants_list_publish_deadline', -1000).toISOString());
        });

        test('should be set by the edit that moves a passed deadline into the future, and stay set', async () => {
            const event = await generator.createEvent({ type: 'epm', ...fixedDates() });
            const now = at('participants_list_publish_deadline', 1000);
            tk.freeze(now);

            const res = await edit(event, { participants_list_publish_deadline: at('participants_list_publish_deadline', 60000) });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_status_revealed_at).toEqual(now.toISOString());
            expect(res.body.data.can_see_participants_list).toEqual(false);
        });
    });
});
