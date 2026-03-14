const fs = require('fs');
const path = require('path');
const { rimraf } = require('rimraf');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');
const config = require('../../config');

const validImagePath = path.resolve(__dirname, '..', '..', '..', 'events', 'test', 'assets', 'valid_image.png');
const validSecondImagePath = path.resolve(__dirname, '..', '..', '..', 'events', 'test', 'assets', 'valid_second_image.PNG');
const invalidImagePath = path.resolve(__dirname, '..', '..', '..', 'events', 'test', 'assets', 'invalid_image.txt');

describe('Summer University image upload regressions', () => {
    let event;

    beforeEach(async () => {
        event = await generator.createEvent({ questions: [] });
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
        await rimraf(config.media_dir);
    });

    test('removes malformed uploads instead of leaving orphaned files behind', async () => {
        const res = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'summer-token' },
            formData: {
                head_image: {
                    value: fs.createReadStream(invalidImagePath),
                    options: { filename: 'image.jpg' }
                }
            }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);

        const imagesPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages');
        expect(fs.existsSync(imagesPath)).toEqual(true);
        expect(fs.readdirSync(imagesPath)).toHaveLength(0);
    });

    test('still replaces the image when the previous file is already missing', async () => {
        const firstResponse = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'summer-token' },
            formData: {
                head_image: fs.createReadStream(validImagePath)
            }
        });

        expect(firstResponse.statusCode).toEqual(200);

        const eventBeforeReplacement = await Event.findByPk(event.id);
        const oldImagePath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventBeforeReplacement.image);
        fs.unlinkSync(oldImagePath);

        const res = await request({
            uri: '/single/' + event.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': 'summer-token' },
            formData: {
                head_image: fs.createReadStream(validSecondImagePath)
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const eventFromDb = await Event.findByPk(event.id);
        expect(eventFromDb.image).not.toEqual(eventBeforeReplacement.image);

        const newImagePath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', eventFromDb.image);
        expect(fs.existsSync(newImagePath)).toEqual(true);
    });
});
