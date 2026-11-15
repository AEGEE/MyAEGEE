const fs = require('fs');
const path = require('path');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const config = require('../../config');

const uploadFolder = path.join(config.media_dir, 'headimages');

describe('File upload', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
        await fs.promises.rm(config.media_dir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        mock.mockAll();
        event = await generator.createEvent();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
        await fs.promises.rm(config.media_dir, { recursive: true, force: true });
    });

    const upload = (files, eventId = event.id) => request({
        path: '/single/' + eventId + '/upload',
        method: 'POST',
        headers: { 'X-Auth-Token': 'foobar' },
        files
    });

    const asset = (name) => path.join(__dirname, '..', 'assets', name);

    test('should return 401 if the user is not authenticated', async () => {
        mock.mockAll({ core: { unauthorized: true }, mainPermissions: { unauthorized: true }, approvePermissions: { unauthorized: true } });

        const res = await upload({ head_image: { path: asset('valid_image.png') } });

        expect(res.statusCode).toEqual(401);
    });

    test('should return 404 if the event does not exist', async () => {
        const res = await upload({ head_image: { path: asset('valid_image.png') } }, 1337);

        expect(res.statusCode).toEqual(404);
    });

    test('should create the upload folder if it does not exist', async () => {
        expect(fs.existsSync(uploadFolder)).toEqual(false);

        await upload({ head_image: { path: asset('valid_image.png') } });

        expect(fs.existsSync(uploadFolder)).toEqual(true);
    });

    test.each([
        ['valid_image.png', '.png'],
        ['valid_image.jpg', '.jpg'],
        ['valid_image.jpeg', '.jpeg'],
        ['valid_second_image.PNG', '.png']
    ])('should upload %s and store it on the event', async (filename, extension) => {
        const res = await upload({ head_image: { path: asset(filename) } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.message).toEqual('File uploaded successfully');
        expect(res.body.data.endsWith(extension)).toEqual(true);

        await event.reload();
        expect(event.image).toEqual(res.body.data);
        expect(fs.existsSync(path.join(uploadFolder, event.image))).toEqual(true);
    });

    test('should replace the old image and remove its file', async () => {
        const first = await upload({ head_image: { path: asset('valid_image.png') } });
        expect(first.statusCode).toEqual(200);
        const oldPath = path.join(uploadFolder, first.body.data);
        expect(fs.existsSync(oldPath)).toEqual(true);

        const second = await upload({ head_image: { path: asset('valid_image.jpg') } });

        expect(second.statusCode).toEqual(200);
        expect(second.body.data).not.toEqual(first.body.data);
        expect(fs.existsSync(oldPath)).toEqual(false);
        expect(fs.existsSync(path.join(uploadFolder, second.body.data))).toEqual(true);

        await event.reload();
        expect(event.image).toEqual(second.body.data);
    });

    // BUG: if the old image file is missing on disk, fs.unlink throws after the event was
    // already updated, so the request fails with a 500 even though the new image is saved.
    test('should currently return 500 if the old image file is missing, but still save the new image', async () => {
        await event.update({ image: 'missing-file.png' });

        const res = await upload({ head_image: { path: asset('valid_image.png') } });

        expect(res.statusCode).toEqual(500);
        await event.reload();
        expect(event.image).not.toEqual('missing-file.png');
    });

    test('should return 422 on an invalid extension', async () => {
        const res = await upload({ head_image: { path: asset('invalid_image.txt') } });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Allowed extensions: \'.png\', \'.jpg\', \'.jpeg\', but \'.txt\' was passed.');
        await event.reload();
        expect(event.image).toEqual(null);
    });

    test('should return 422 if the content is not an image', async () => {
        const res = await upload({ head_image: { path: asset('invalid_image.jpg') } });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('Malformed file content.');
        await event.reload();
        expect(event.image).toEqual(null);
    });

    test('should return 422 if the content does not match the extension', async () => {
        const res = await upload({ head_image: { path: asset('valid_image.png'), filename: 'image.jpg' } });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('Malformed file content.');
    });

    test('should return 422 if a JPEG is uploaded with a .png extension', async () => {
        const res = await upload({ head_image: { path: asset('valid_image.jpeg'), filename: 'image.png' } });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('Malformed file content.');
    });

    test('should return 422 if the head_image field is missing', async () => {
        const res = await upload({ wrong_field: { path: asset('valid_image.png') } });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should return 422 if no file is sent', async () => {
        const res = await upload({});

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('No head_image is specified.');
    });

    // Note: there is no permission check, any authenticated user can replace the image.
    test('should currently allow any authenticated user to upload an image', async () => {
        mock.mockAll({ core: { notSuperadmin: true }, mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

        const res = await upload({ head_image: { path: asset('valid_image.png') } });

        expect(res.statusCode).toEqual(200);
    });
});
