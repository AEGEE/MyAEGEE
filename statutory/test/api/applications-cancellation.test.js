const tk = require('timekeeper');
const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Application } = require('../../models');

describe('Applications cancellation', () => {
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
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should succeed for current user within the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication({ user_id: regularUser.id }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/me/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
        expect(res.body.data.cancelled).toEqual(true);
    });

    test('should not succeed for current user if not within the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication({ user_id: regularUser.id }, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/me/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed for other user when the permissions are okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.cancelled).toEqual(true);
    });

    test('should return 403 for other user when user does not have permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the application is not found for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/me/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if the application is not found for other user', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/applications/333/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if cancelled is invalid', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: 'lalala' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should let the applicant undo the cancellation within the period', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ user_id: regularUser.id, cancelled: true }, event);

        tk.freeze(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/me/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: false }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.cancelled).toEqual(false);

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.cancelled).toEqual(false);
    });

    // The applicant may cancel during the application period, both ends included.
    describe('the application period', () => {
        test.each([
            ['refuses the applicant 1 ms before the period starts', 'application_period_starts', -1, 403],
            ['lets the applicant cancel exactly when the period starts (inclusive)', 'application_period_starts', 0, 200],
            ['lets the applicant cancel exactly when the period ends (inclusive)', 'application_period_ends', 0, 200],
            ['refuses the applicant 1 ms after the period ends', 'application_period_ends', 1, 403]
        ])('%s', async (name, field, offset, status) => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({ user_id: regularUser.id }, event);

            tk.freeze(moment(event[field]).add(offset, 'ms').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/me/cancel',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { cancelled: true }
            });

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.cancelled).toEqual(status === 200);
        });

        test('lets those who manage the applications cancel after the period', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:agora'] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 2 }, event);

            tk.freeze(moment(event.application_period_ends).add(1, 'ms').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/cancel',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { cancelled: true }
            });

            expect(res.statusCode).toEqual(200);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.cancelled).toEqual(true);
        });

        // Unlike applying and editing: the permission to apply outside of the period does not
        // cover cancelling.
        test('refuses the applicant after the period, also with the permission to apply outside of it', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:apply:agora'] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: regularUser.id }, event);

            tk.freeze(moment(event.application_period_ends).add(1, 'ms').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/me/cancel',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { cancelled: true }
            });

            expect(res.statusCode).toEqual(403);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.cancelled).toEqual(false);
        });
    });

    describe('who may cancel somebody else\'s application', () => {
        test.each([
            ['global:manage_applications:agora', 200],
            ['global:manage_applications:epm', 403],
            ['global:manage_incoming:agora', 403],
            ['global:manage_juridical:agora', 403],
            ['global:update_memberslist_status:agora', 403],
            ['global:approve_members:agora', 403],
            ['global:apply:agora', 403]
        ])('%s alone answers %i on an Agora', async (permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

            // Within the period, when applicants may cancel their own.
            tk.freeze(moment(event.application_period_starts).add(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/cancel',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { cancelled: true }
            });

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            // Nothing is stored when the request is refused.
            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.cancelled).toEqual(status === 200);
        });

        test('should return 403 for a board member of the applicant\'s body', async () => {
            // The core mock makes the user a board member of their first body.
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 2, body_id: regularUser.bodies[0].id }, event);

            tk.freeze(moment(event.application_period_starts).add(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/cancel',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { cancelled: true }
            });

            expect(res.statusCode).toEqual(403);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.cancelled).toEqual(false);
        });
    });
});
