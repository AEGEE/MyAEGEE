const fs = require('fs');
const path = require('path');
const { rimraf } = require('rimraf');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');
const config = require('../../config');

describe('Users image upload', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
        rimraf(config.media_dir);
    });

    it('should create an upload folder if it doesn\'t exist', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await request({
            uri: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_image.png')
            }
        });

        expect(fs.existsSync(config.media_dir)).toEqual(true);
    });

    it('should fail if the uploaded file is not an image (by extension)', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            formData: {
                head_image: fs.createReadStream('./test/assets/invalid_image.txt')
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should fail if the uploaded file is not an image (by content)', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
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
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            formData: {}
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('No head_image is specified.');
    });

    it('should upload a file if it\'s valid', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_image.png')
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.findByPk(user.id);

        const imgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', userFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should upload a file if it\'s valid, but has extension in capital letters', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_second_image.PNG')
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.findByPk(user.id);

        const imgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', userFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should remove the old file', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        // Uploading
        const firstRequest = await request({
            uri: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_image.png')
            }
        });

        expect(firstRequest.statusCode).toEqual(200);

        const userFromDb = await User.findByPk(user.id);

        const res = await request({
            uri: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            formData: {
                head_image: fs.createReadStream('./test/assets/valid_image.png')
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const oldImgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', userFromDb.image);
        expect(fs.existsSync(oldImgPath)).toEqual(false);
    });
});
