const fs = require('fs');
const path = require('path');
const { rimraf } = require('rimraf');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Image } = require('../../models');
const config = require('../../config');
const regularUser = require('../assets/core-valid.json').data;

// What a client gets of an image: not where the server keeps the file, nor who uploaded it.
const IMAGE_FIELDS = ['created_at', 'file_name', 'frontend_path', 'id', 'updated_at'];

describe('Candidates image upload', () => {
    let event;
    let position;
    let candidate;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        event = await generator.createEvent({ type: 'agora' });
        position = await generator.createPosition({}, event);
        candidate = await generator.createCandidate({}, position);

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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {
                image: {
                    path: './test/assets/valid_image_2.Png'
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: { image: { path: './test/assets/valid_image.png' } }
        });

        expect(res.statusCode).toEqual(403);
        expect(await Image.count()).toEqual(imagesBefore);
        expect(listUploadedFiles()).toEqual([]);
    });

    it('should not leave a file with malformed content on disk', async () => {
        const imagesBefore = await Image.count();
        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: {},
            fields: { some_field: 'value' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('No image is specified.');
    });

    it('should return the image of a candidate without the server path and the uploader', async () => {
        await candidate.update({ user_id: regularUser.id, status: 'approved' });

        const upload = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: { image: { path: './test/assets/valid_image.png' } }
        });
        expect(upload.statusCode).toEqual(200);

        const get = (suffix) => request({
            path: '/events/' + event.id + '/positions' + suffix,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        const single = await get('/' + position.id + '/candidates/' + candidate.id);
        expect(single.statusCode).toEqual(200);
        expect(Object.keys(single.body.data.image).sort()).toEqual(IMAGE_FIELDS);

        const mine = await get('/candidates/mine');
        expect(mine.statusCode).toEqual(200);
        expect(Object.keys(mine.body.data[0].image).sort()).toEqual(IMAGE_FIELDS);

        for (const suffix of ['/all', '/approved']) {
            const positions = await get(suffix);
            expect(positions.statusCode).toEqual(200);
            expect(Object.keys(positions.body.data[0].candidates[0].image).sort()).toEqual(IMAGE_FIELDS);
        }
    });

    describe('who may upload the image of a candidature', () => {
        const MANAGE = 'global:manage_candidates:agora';

        const upload = (candidateId, targetEvent = event, targetPosition = position) => request({
            path: '/events/' + targetEvent.id + '/positions/' + targetPosition.id + '/candidates/' + candidateId + '/image',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            files: { image: { path: './test/assets/valid_image.png' } }
        });

        // The images table is not emptied between tests, so the tests count from where they start.
        let imagesBefore;

        beforeEach(async () => {
            imagesBefore = await Image.count();
        });

        const nothingStored = async () => {
            expect(await Image.count()).toEqual(imagesBefore);
            expect(listUploadedFiles()).toEqual([]);
        };

        test.each([
            ['lets', 'a candidate without permissions', 'their own pending candidature', [], regularUser.id, 'pending', 200],
            ['refuses', 'a candidate without permissions', 'their own approved candidature', [], regularUser.id, 'approved', 403],
            ['refuses', 'a candidate without permissions', 'their own rejected candidature', [], regularUser.id, 'rejected', 403],
            ['refuses', 'a holder of the permission for another event type', 'the pending candidature of someone else', ['global:manage_candidates:epm', 'global:manage_event:agora'], 1337, 'pending', 403],
            ['lets', 'a holder of global:manage_candidates:agora alone', 'the approved candidature of someone else', [MANAGE], 1337, 'approved', 200]
        ])('%s %s upload the image of %s', async (verb, who, what, permissions, userId, status, expected) => {
            mock.mockAll({ mainPermissions: { permissions } });
            await candidate.update({ user_id: userId, status });

            const res = await upload(candidate.id);

            expect(res.statusCode).toEqual(expected);
            if (expected === 200) {
                const image = await Image.findOne({ order: [['id', 'DESC']] });
                expect(await Image.count()).toEqual(imagesBefore + 1);
                expect(res.body.data.image.id).toEqual(image.id);
                expect((await candidate.reload()).image_id).toEqual(image.id);
                expect(listUploadedFiles()).toEqual([image.file_name]);
            } else {
                expect(res.body).toEqual({ success: false, message: 'You cannot edit this candidature.' });
                expect((await candidate.reload()).image_id).toEqual(null);
                await nothingStored();
            }
        });

        test.each([
            ['an unknown candidate', '2147483647', 404, 'Candidate is not found.'],
            ['a candidate id that is not a number', 'abc', 400, 'The candidate ID is invalid.']
        ])('stores no file for %s', async (description, candidateId, status, message) => {
            const res = await upload(candidateId);

            expect(res.statusCode).toEqual(status);
            expect(res.body).toEqual({ success: false, message });
            await nothingStored();
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event and stores no file', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE, `global:manage_candidates:${type}`] } });
            const otherEvent = await generator.createEvent({ type });
            const otherPosition = await generator.createPosition({}, otherEvent);
            const otherCandidate = await generator.createCandidate({ user_id: regularUser.id }, otherPosition);

            const res = await upload(otherCandidate.id, otherEvent, otherPosition);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
            await nothingStored();
        });
    });
});
