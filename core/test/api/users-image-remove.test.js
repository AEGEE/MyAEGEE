const fs = require('fs');
const path = require('path');
const { rimraf } = require('rimraf');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');
const config = require('../../config');

describe('Users image remove', () => {
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

    it('should fail if the user has no image', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id + '/image',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should remove a file', async () => {
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

        let userFromDb = await User.findByPk(user.id);

        const res = await request({
            uri: '/members/' + user.id + '/image',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const oldImgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', userFromDb.image);
        expect(fs.existsSync(oldImgPath)).toEqual(false);

        userFromDb = await User.findByPk(user.id);
        expect(userFromDb.image).toEqual(null);
    });
});
