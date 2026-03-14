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
        rimraf(config.media_dir);
    });

    it('should create an upload folder if it doesn\'t exist', async () => {
        rimraf(config.media_dir);

        await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_image.png')
            }
        });

        expect(fs.existsSync(config.media_dir)).toEqual(true);
    });

    it('should fail if the uploaded file is not an image (by extension)', async () => {
        const res = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {
                head_image: fs.createReadStream('./test/assets/invalid_image.txt')
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should fail if the uploaded file is not an image (by content)', async () => {
        const res = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {
                head_image: {
                    value: fs.createReadStream('./test/assets/invalid_image.txt'),
                    options: {
                        filename: 'image.jpg'
                    }
                }
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should fail the \'head_image\' field is not specified', async () => {
        const res = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {}
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('No head_image is specified.');
    });

    it('should upload a file if it\'s valid', async () => {
        const res = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_image.png')
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
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_second_image.PNG')
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
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_image.png')
            }
        });

        expect(firstRequest.statusCode).toEqual(200);

        const eventFromDb = await Event.findByPk(event.id);

        const res = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_image.png')
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const oldImgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventFromDb.image);
        expect(fs.existsSync(oldImgPath)).toEqual(false);
    });

    it('should replace the image even when the old file is already missing', async () => {
        const firstRequest = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_image.png')
            }
        });

        expect(firstRequest.statusCode).toEqual(200);

        const eventBeforeReplacement = await Event.findByPk(event.id);
        const oldImgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventBeforeReplacement.image);
        fs.unlinkSync(oldImgPath);

        const res = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_second_image.PNG')
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const eventFromDb = await Event.findByPk(event.id);
        expect(eventFromDb.image).not.toEqual(eventBeforeReplacement.image);

        const newImgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventFromDb.image);
        expect(fs.existsSync(newImgPath)).toEqual(true);
    });
});
