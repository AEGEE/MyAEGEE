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
        await rimraf(config.media_dir);
    });

    it('should create an upload folder if it doesn\'t exist', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(fs.existsSync(config.media_dir)).toEqual(true);
    });

    it('should fail if the uploaded file is not an image (by extension)', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
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
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
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
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {}
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('No head_image is specified.');
    });

    it('should upload a file if it\'s valid', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.findByPk(user.id);

        const imgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', userFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should upload a JPEG file with a .jpg extension', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_image.jpg'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.findByPk(user.id);

        const imgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', userFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should upload a JPEG file with a .jpeg extension', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_image.jpeg'
                }
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
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_second_image.PNG'
                }
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

        const userFromDb = await User.findByPk(user.id);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const oldImgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', userFromDb.image);
        expect(fs.existsSync(oldImgPath)).toEqual(false);
    });

    it('should update a valid image to only another user if other user is selected', async () => {
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

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {
                head_image: {
                    path: './test/assets/valid_second_image.PNG'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.findByPk(user.id);

        const imgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', userFromDb.image);
        expect(fs.existsSync(imgPath)).toEqual(true);

        const adminFromDb = await User.findByPk(admin.id);

        expect(adminFromDbBeforeChange.image).toEqual(adminFromDb.image);

        const adminImgPath = path.join(__dirname, '..', '..', config.media_dir, 'headimages', adminFromDb.image);
        expect(fs.existsSync(adminImgPath)).toEqual(true);
    });

    const uploadFolder = path.join(config.media_dir, 'headimages');
    const upload = (userId, token, file = './test/assets/valid_image.png', filename = undefined) => request({
        path: '/members/' + userId + '/upload',
        method: 'POST',
        headers: { 'X-Auth-Token': token.value },
        files: { head_image: { path: file, filename } }
    });

    it('should let a user upload their own image', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await upload(user.id, token);

        expect(res.statusCode).toEqual(200);
        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.image).toEqual(res.body.data);
    });

    it('should return 403 when uploading an image for another user without update:member', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const otherUser = await generator.createUser();

        const res = await upload(otherUser.id, token);

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);

        const otherUserFromDb = await User.findByPk(otherUser.id);
        expect(otherUserFromDb.image).toEqual(null);
        // The file is refused before anything is stored.
        expect(fs.existsSync(uploadFolder)).toEqual(false);
    });

    it('should let a user with global update:member upload an image for another user', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await upload(otherUser.id, token);

        expect(res.statusCode).toEqual(200);
        const otherUserFromDb = await User.findByPk(otherUser.id);
        expect(otherUserFromDb.image).toEqual(res.body.data);
    });

    it('should let a user with local update:member upload an image for a member of that body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await upload(otherUser.id, token);

        expect(res.statusCode).toEqual(200);
    });

    it('should save the new image even if the old image file is missing', async () => {
        const user = await generator.createUser({ image: 'missing-file.png' });
        const token = await generator.createAccessToken(user);

        const res = await upload(user.id, token);

        expect(res.statusCode).toEqual(200);
        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.image).toEqual(res.body.data);
        expect(fs.existsSync(path.join(uploadFolder, res.body.data))).toEqual(true);
    });

    it('should refuse images over 5 MB without leaving a file on disk', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: { head_image: { buffer: Buffer.alloc(5 * 1024 * 1024 + 1), filename: 'big.png' } }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('The image should be at most 5 MB.');
        expect(fs.readdirSync(uploadFolder)).toEqual([]);
    });

    it('should not leave a file with malformed content on disk', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await upload(user.id, token, './test/assets/invalid_image.txt', 'image.jpg');

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('Malformed file content.');
        expect(fs.readdirSync(uploadFolder)).toEqual([]);
    });

    it('should return 422 if the file is sent in another field than head_image', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: { wrong_field: { path: './test/assets/valid_image.png' } }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    it('should return 422 if the form has fields but no file', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/upload',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {},
            fields: { some_field: 'value' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('No head_image is specified.');
    });
});
