const fs = require('fs');
const path = require('path');
const { rimraf } = require('rimraf');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Image } = require('../../models');
const config = require('../../config');

// What a client gets of an image: not where the server keeps the file, nor who uploaded it.
const IMAGE_FIELDS = ['created_at', 'file_name', 'frontend_path', 'id', 'updated_at'];
const log = require('../../lib/logger');

describe('Events image upload', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        event = await generator.createEvent();
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();

        await generator.clearAll();
        await rimraf(config.images_dir);
    });

    it('should create an upload folder if it doesn\'t exist', async () => {
        await rimraf(config.images_dir);

        await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(fs.existsSync(config.images_dir)).toEqual(true);
    });

    it('should fail if the uploaded file is not an image (by extension)', async () => {
        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
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
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/invalid_image.txt',
                    filename: 'image.jpg'
                }
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should fail the \'image\' field is not specified', async () => {
        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {}
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('No image is specified.');
    });

    it('should upload a file if it\'s valid', async () => {
        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('image');
        expect(Object.keys(res.body.data.image).sort()).toEqual(IMAGE_FIELDS);

        const imgPath = path.join(
            __dirname,
            '..',
            '..',
            config.images_dir,
            res.body.data.image.frontend_path
        );
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should upload a JPEG file with a .jpg extension', async () => {
        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image.jpg'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('image');
        expect(Object.keys(res.body.data.image).sort()).toEqual(IMAGE_FIELDS);

        const imgPath = path.join(
            __dirname,
            '..',
            '..',
            config.images_dir,
            res.body.data.image.frontend_path
        );
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should upload a JPEG file with a .jpeg extension', async () => {
        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image.jpeg'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('image');
        expect(Object.keys(res.body.data.image).sort()).toEqual(IMAGE_FIELDS);

        const imgPath = path.join(
            __dirname,
            '..',
            '..',
            config.images_dir,
            res.body.data.image.frontend_path
        );
        expect(fs.existsSync(imgPath)).toEqual(true);
    });

    it('should remove the old file', async () => {
        // Uploading
        const firstRequest = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(firstRequest.statusCode).toEqual(200);

        const oldImgPath = path.join(
            __dirname,
            '..',
            '..',
            config.images_dir,
            firstRequest.body.data.image.frontend_path
        );
        const oldImgId = firstRequest.body.data.image.id;

        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('image');
        expect(Object.keys(res.body.data.image).sort()).toEqual(IMAGE_FIELDS);

        expect(fs.existsSync(oldImgPath)).toEqual(false);

        const imagesCount = await Image.findByPk(oldImgId);
        expect(imagesCount).toBeFalsy();
    });

    it('should fail if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    it('should not crash when the file deletion cannot be done', async () => {
        // Uploading
        const firstRequest = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(firstRequest.statusCode).toEqual(200);

        const oldImgPath = path.join(
            __dirname,
            '..',
            '..',
            config.images_dir,
            firstRequest.body.data.image.frontend_path
        );
        await fs.promises.unlink(oldImgPath);

        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image.png'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    const listUploadedFiles = () => (fs.existsSync(config.images_dir) ? fs.readdirSync(config.images_dir) : []);

    it('should refuse the upload before storing anything if no permissions', async () => {
        const imagesBefore = await Image.count();
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: { image: { path: './test/assets/valid_image.png' } }
        });

        expect(res.statusCode).toEqual(403);
        expect(await Image.count()).toEqual(imagesBefore);
        expect(listUploadedFiles()).toEqual([]);
    });

    it('should refuse images over 5 MB without leaving a file on disk', async () => {
        const imagesBefore = await Image.count();
        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: { image: { buffer: Buffer.alloc(5 * 1024 * 1024 + 1), filename: 'big.png' } }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('The image should be at most 5 MB.');
        expect(await Image.count()).toEqual(imagesBefore);
        expect(listUploadedFiles()).toEqual([]);
    });

    it('should log a refused upload through the error serializer', async () => {
        const errorLog = jest.spyOn(log, 'error');

        await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: { image: { buffer: Buffer.alloc(5 * 1024 * 1024 + 1), filename: 'big.png' } }
        });

        expect(errorLog).toHaveBeenCalledWith({ err: expect.any(Error) }, 'Could not store image');
        errorLog.mockRestore();
    });

    it('should not leave a file with malformed content on disk', async () => {
        const imagesBefore = await Image.count();
        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: { image: { path: './test/assets/invalid_image.txt', filename: 'image.jpg' } }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('Malformed file content.');
        expect(await Image.count()).toEqual(imagesBefore);
        expect(listUploadedFiles()).toEqual([]);
    });

    it('should return 422 if the form has fields but no file', async () => {
        const res = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {},
            fields: { some_field: 'value' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('No image is specified.');
    });

    it('should return the image of an event without the server path and the uploader', async () => {
        const upload = await request({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: { image: { path: './test/assets/valid_image.png' } }
        });
        expect(upload.statusCode).toEqual(200);

        const single = await request({
            path: '/events/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });
        expect(single.statusCode).toEqual(200);
        expect(Object.keys(single.body.data.image).sort()).toEqual(IMAGE_FIELDS);
        expect(single.body.data.image.frontend_path).toEqual('/' + single.body.data.image.file_name);

        const list = await request({ path: '/', method: 'GET' });
        expect(list.statusCode).toEqual(200);
        expect(list.body.data.length).toEqual(1);
        expect(Object.keys(list.body.data[0].image).sort()).toEqual(IMAGE_FIELDS);
    });
});
