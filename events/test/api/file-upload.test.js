const fs = require('fs');
const path = require('path');
const { rimraf } = require('rimraf');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');
const config = require('../../config');
const user = require('../assets/oms-core-valid.json').data;

describe('File upload', () => {
    let event;

    beforeEach(async () => {
        event = await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }] });
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
        await rimraf(config.media_dir);
    });

    it('should create an upload folder if it doesn\'t exist', async () => {
        await rimraf(config.media_dir);

        await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                head_image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(fs.existsSync(config.media_dir)).toEqual(true);
    });

    it('should fail if the uploaded file is not an image (by extension)', async () => {
        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                head_image: {
                    path: './test/assets/invalid_image.txt'
                }
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should fail if the uploaded file is not an image (by content)', async () => {
        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                head_image: {
                    path: './test/assets/invalid_image.txt',
                    filename: 'image.jpg'
                }
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should fail the \'head_image\' field is not specified', async () => {
        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {}
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('No head_image is specified.');
    });

    it('should upload a file if it\'s valid', async () => {
        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                head_image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findByPk(event.id);

        const imgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should upload a JPEG file with a .jpg extension', async () => {
        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                head_image: {
                    path: './test/assets/valid_image.jpg'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findByPk(event.id);

        const imgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should upload a JPEG file with a .jpeg extension', async () => {
        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                head_image: {
                    path: './test/assets/valid_image.jpeg'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findByPk(event.id);

        const imgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should upload a file if it\'s valid, but has extension in capital letters', async () => {
        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                head_image: {
                    path: './test/assets/valid_second_image.PNG'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findByPk(event.id);

        const imgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should remove the old file', async () => {
        // Uploading
        const firstRequest = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                head_image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(firstRequest.statusCode).toEqual(200);

        const eventFromDb = await Event.findByPk(event.id);

        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                head_image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const oldImgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventFromDb.image);
        expect(fs.existsSync(oldImgPath)).toEqual(false);
    });

    const upload = (eventId, file = './test/assets/valid_image.png', filename = undefined) => request({
        path: '/single/' + eventId + '/upload',
        method: 'POST',
        headers: { 'X-Auth-Token': 'blablabla' },
        files: { head_image: { path: file, filename } }
    });
    const uploadFolder = path.join(config.media_dir, 'headimages');

    it('should save the new image even if the old image file is missing', async () => {
        await event.update({ image: 'missing-file.png' });

        const res = await upload(event.id);

        expect(res.statusCode).toEqual(200);
        const eventFromDb = await Event.findByPk(event.id);
        expect(eventFromDb.image).toEqual(res.body.data);
        expect(fs.existsSync(path.join(uploadFolder, res.body.data))).toEqual(true);
    });

    it('should not leave a file with malformed content on disk', async () => {
        const res = await upload(event.id, './test/assets/invalid_image.txt', 'image.jpg');

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('Malformed file content.');
        expect(fs.readdirSync(uploadFolder)).toEqual([]);
    });

    it('should not leave a file whose content does not match the extension on disk', async () => {
        const res = await upload(event.id, './test/assets/valid_image.png', 'image.jpg');

        expect(res.statusCode).toEqual(422);
        expect(fs.readdirSync(uploadFolder)).toEqual([]);
    });

    it('should return 422 if the file is sent in another field than head_image', async () => {
        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: { wrong_field: { path: './test/assets/valid_image.png' } }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    it('should return 422 if the form has fields but no file', async () => {
        const res = await request({
            path: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {},
            fields: { some_field: 'value' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('No head_image is specified.');
    });

    it('should return 403 for a user who is neither an organizer nor a manager', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const notMineEvent = await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: 333 }] });

        const res = await upload(notMineEvent.id);

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('You cannot edit this event');

        const eventFromDb = await Event.findByPk(notMineEvent.id);
        expect(eventFromDb.image).toEqual(null);
        // The file is refused before anything is stored.
        expect(fs.existsSync(uploadFolder)).toEqual(false);
    });

    it('should return 403 for an organizer once the event is no longer a draft', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        await event.update({ status: 'published' });

        const res = await upload(event.id);

        expect(res.statusCode).toEqual(403);
    });

    it('should allow an organizer to upload an image to a draft event', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await upload(event.id);

        expect(res.statusCode).toEqual(200);
        const eventFromDb = await Event.findByPk(event.id);
        expect(eventFromDb.image).toEqual(res.body.data);
    });

    it('should allow a manager who is not an organizer to upload an image to a published event', async () => {
        const notMineEvent = await generator.createEvent({ status: 'published', organizers: [{ first_name: 'test', last_name: 'test', user_id: 333 }] });

        const res = await upload(notMineEvent.id);

        expect(res.statusCode).toEqual(200);
    });
});
