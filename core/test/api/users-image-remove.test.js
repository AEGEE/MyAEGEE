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
        await rimraf(config.media_dir);
    });

    it('should fail if the user has no image', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/image',
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
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(firstRequest.statusCode).toEqual(200);

        let userFromDb = await User.findByPk(user.id);

        const res = await request({
            path: '/members/' + user.id + '/image',
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

    it('should remove a file of another user', async () => {
        const admin = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(admin);
        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const user = await generator.createUser();

        const firstRequest = await request({
            path: '/members/' + admin.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(firstRequest.statusCode).toEqual(200);

        const adminFromDbBeforeChange = await User.findByPk(admin.id);

        const secondRequest = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_second_image.PNG'
                }
            }
        });

        expect(secondRequest.statusCode).toEqual(200);

        let userFromDb = await User.findByPk(user.id);

        const res = await request({
            path: '/members/' + user.id + '/image',
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

        const adminFromDb = await User.findByPk(admin.id);

        expect(adminFromDb.image).not.toEqual(null);
        expect(adminFromDbBeforeChange.image).toEqual(adminFromDb.image);

        const adminImgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', adminFromDb.image);
        expect(fs.existsSync(adminImgPath)).toEqual(true);
    });

    it('should return 403 when removing the image of another user without update:member', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const otherUser = await generator.createUser();
        const otherToken = await generator.createAccessToken(otherUser);

        const uploadRes = await request({
            path: '/members/' + otherUser.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': otherToken.value },
            files: { head_image: { path: './test/assets/valid_image.png' } }
        });
        expect(uploadRes.statusCode).toEqual(200);

        const res = await request({
            path: '/members/' + otherUser.id + '/image',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);

        const otherUserFromDb = await User.findByPk(otherUser.id);
        expect(otherUserFromDb.image).toEqual(uploadRes.body.data);
        const imgPath = path.join(config.media_dir, 'headimages', otherUserFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should clear the image even if its file is missing', async () => {
        const user = await generator.createUser({ image: 'missing-file.png' });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/image',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.image).toEqual(null);
    });
});
