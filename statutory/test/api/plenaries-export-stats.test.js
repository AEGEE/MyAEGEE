const xlsx = require('node-xlsx');
const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Plenaries exports', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return right amount of sheets and sort plenaries', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPlenary({
            name: 'Test plenary 1',
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate(),
        }, event);
        await generator.createPlenary({
            name: 'Test plenary 3',
            starts: moment().add(5, 'week').toDate(),
            ends: moment().add(6, 'week').toDate(),
        }, event);
        await generator.createPlenary({
            name: 'Test plenary 2',
            starts: moment().add(3, 'week').toDate(),
            ends: moment().add(4, 'week').toDate(),
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(5); // 1 general + + 1 bodies + 3 plenaries

        expect(data[0].name).toEqual('Stats (general)');
        expect(data[2].name).toEqual('1 - Test plenary 1');
        expect(data[3].name).toEqual('2 - Test plenary 2');
        expect(data[4].name).toEqual('3 - Test plenary 3');
    });

    test('should return right plenary details', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({
            name: 'Test plenary',
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(1, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(3); // 1 general + + 1 bodies + 1 plenary

        const plenaryDetailsSheet = data[2];
        expect(plenaryDetailsSheet.name).toEqual('1 - Test plenary');

        const plenarySheetData = plenaryDetailsSheet.data;
        expect(plenarySheetData[0][1]).toEqual(plenary.name); // B1
        expect(plenarySheetData[1][1]).toEqual(moment(plenary.starts).format('YYYY-MM-DD HH:mm:ss')); // B2
        expect(plenarySheetData[2][1]).toEqual(moment(plenary.ends).format('YYYY-MM-DD HH:mm:ss')); // B3
        expect(plenarySheetData[3][1]).toEqual(3600.0.toFixed(2)); // B4
    });

    test('should return right attendances details for plenary', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({
            name: 'Test plenary',
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(1, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);
        const application = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);

        // second attendance in list, all the time should be tracked
        const secondAttendance = await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.starts).add(1, 'minute').toDate(),
            ends: moment(plenary.starts).add(3, 'minute').toDate(),
        }, plenary);

        // first attendance in list, only 1 minute should be tracked
        const firstAttendance = await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.starts).subtract(1, 'minute').toDate(),
            ends: moment(plenary.starts).add(1, 'minute').toDate(),
        }, plenary);

        // third attendance in list, only 1 minute should be tracked
        const thirdAttendance = await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.ends).subtract(1, 'minute').toDate(),
            ends: moment(plenary.ends).add(1, 'minute').toDate(),
        }, plenary);


        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(3); // 1 general + 1 bodies + 1 plenary

        const plenaryDetailsSheet = data[2];
        const plenarySheetData = plenaryDetailsSheet.data;
        expect(plenarySheetData.length).toEqual(9); // 4 plenary details, empty line, headers, 3 attendances

        expect(plenarySheetData[6][3]).toEqual(moment(firstAttendance.starts).format('YYYY-MM-DD HH:mm:ss'));
        expect(plenarySheetData[6][4]).toEqual(moment(firstAttendance.ends).format('YYYY-MM-DD HH:mm:ss'));
        expect(plenarySheetData[6][5]).toEqual(60.0.toFixed(2)); // only 60 seconds tracked
        expect(plenarySheetData[6][6]).toEqual((60 / 3600 * 100).toFixed(2) + '%');

        expect(plenarySheetData[7][3]).toEqual(moment(secondAttendance.starts).format('YYYY-MM-DD HH:mm:ss'));
        expect(plenarySheetData[7][4]).toEqual(moment(secondAttendance.ends).format('YYYY-MM-DD HH:mm:ss'));
        expect(plenarySheetData[7][5]).toEqual(120.0.toFixed(2)); // all 2 minutes tracked
        expect(plenarySheetData[7][6]).toEqual((120 / 3600 * 100).toFixed(2) + '%');

        expect(plenarySheetData[8][3]).toEqual(moment(thirdAttendance.starts).format('YYYY-MM-DD HH:mm:ss'));
        expect(plenarySheetData[8][4]).toEqual(moment(thirdAttendance.ends).format('YYYY-MM-DD HH:mm:ss'));
        expect(plenarySheetData[8][5]).toEqual(60.0.toFixed(2)); // 60 seconds tracked
        expect(plenarySheetData[8][6]).toEqual((60 / 3600 * 100).toFixed(2) + '%');
    });

    test('should return 0 for attendance length if it\'s not finished', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({
            name: 'Test plenary',
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(1, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);
        const application = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);

        // second attendance in list, all the time should be tracked
        const attendance = await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.starts).add(1, 'minute').toDate(),
            ends: null
        }, plenary);


        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(3); // 1 general + + 1 bodies + 1 plenary

        const plenaryDetailsSheet = data[2];
        const plenarySheetData = plenaryDetailsSheet.data;
        expect(plenarySheetData.length).toEqual(7); // 4 plenary details, empty line, headers, 1 attendance

        expect(plenarySheetData[6][3]).toEqual(moment(attendance.starts).format('YYYY-MM-DD HH:mm:ss'));
        expect(plenarySheetData[6][4]).toBeUndefined();
        expect(plenarySheetData[6][5]).toEqual('0.00'); // only 60 seconds tracked
        expect(plenarySheetData[6][6]).toEqual('0.00%');
    });

    test('should return 0 for attendance length if it\'s not overlapping plenary', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({
            name: 'Test plenary',
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(1, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);
        const application = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);

        // second attendance in list, all the time should be tracked
        const attendance = await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.starts).subtract(2, 'minute').toDate(),
            ends: moment(plenary.starts).subtract(1, 'minute').toDate(),
        }, plenary);


        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(3); // 1 general + + 1 bodies + 1 plenary

        const plenaryDetailsSheet = data[2];
        const plenarySheetData = plenaryDetailsSheet.data;
        expect(plenarySheetData.length).toEqual(7); // 4 plenary details, empty line, headers, 1 attendance

        expect(plenarySheetData[6][3]).toEqual(moment(attendance.starts).format('YYYY-MM-DD HH:mm:ss'));
        expect(plenarySheetData[6][4]).toEqual(moment(attendance.ends).format('YYYY-MM-DD HH:mm:ss'));
        expect(plenarySheetData[6][5]).toEqual('0.00'); // only 60 seconds tracked
        expect(plenarySheetData[6][6]).toEqual('0.00%');
    });

    test('should calculate the total time for single plenary correctly', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({
            name: 'Test plenary',
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(1, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);
        const application = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);

        // not tracked
        await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.starts).subtract(2, 'minute').toDate(),
            ends: moment(plenary.starts).subtract(1, 'minute').toDate(),
        }, plenary);

        // tracked 1 minute
        await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.starts).subtract(1, 'minute').toDate(),
            ends: moment(plenary.starts).add(1, 'minute').toDate(),
        }, plenary);

        // tracked 3 minute
        await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.starts).add(1, 'minute').toDate(),
            ends: moment(plenary.starts).add(4, 'minute').toDate(),
        }, plenary);

        // tracked 1 minute
        await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.ends).subtract(1, 'minute').toDate(),
            ends: moment(plenary.ends).add(1, 'minute').toDate(),
        }, plenary);

        // not tracked
        await generator.createAttendance({
            application_id: application.id,
            starts: moment(plenary.ends).add(1, 'minute').toDate(),
            ends: moment(plenary.ends).add(2, 'minute').toDate(),
        }, plenary);


        // total: 1 + 3 + 1 = 5 minutes

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(3); // 1 general + + 1 bodies + 1 plenary

        const plenaryDetailsSheet = data[0];
        const plenarySheetData = plenaryDetailsSheet.data;
        expect(plenarySheetData.length).toEqual(2); // headers + 1 application

        const firstApplicationSheet = plenarySheetData[1];
        expect(firstApplicationSheet.length).toEqual(6); // application ID, first/last name, body name, plenary seconds, total, avg

        expect(firstApplicationSheet[0]).toEqual(application.id);
        expect(firstApplicationSheet[1]).toEqual(application.first_name + ' ' + application.last_name);
        expect(firstApplicationSheet[2]).toEqual(application.body_name);
        expect(firstApplicationSheet[3]).toEqual(300.0.toFixed(2)); // 5 minutes
        expect(firstApplicationSheet[4]).toEqual((300 / 3600 * 100).toFixed(2) + '%'); // same in percents
        expect(firstApplicationSheet[5]).toEqual((300 / 3600 * 100).toFixed(2) + '%'); // the avg for single plenary should be the same
    });

    test('should calculate the average time for all plenaries correctly', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const firstPlenary = await generator.createPlenary({
            name: 'First',
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(1, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);

        const secondPlenary = await generator.createPlenary({
            name: 'Second',
            starts: moment().add(2, 'week').toDate(),
            ends: moment().add(2, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);

        await generator.createPlenary({
            name: 'Third',
            starts: moment().add(2, 'week').toDate(),
            ends: moment().add(2, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);
        const application = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);

        // first plenary is fully attended
        await generator.createAttendance({
            application_id: application.id,
            starts: moment(firstPlenary.starts).subtract(1, 'minute').toDate(),
            ends: moment(firstPlenary.ends).add(1, 'minute').toDate(),
        }, firstPlenary);

        // second as well
        await generator.createAttendance({
            application_id: application.id,
            starts: moment(secondPlenary.starts).subtract(1, 'minute').toDate(),
            ends: moment(secondPlenary.ends).add(1, 'minute').toDate(),
        }, secondPlenary);

        // third is not attended at all.
        // total: 66.67%

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(5); // 1 general + + 1 bodies + 3 plenaries

        const plenaryDetailsSheet = data[0];
        const plenarySheetData = plenaryDetailsSheet.data;
        expect(plenarySheetData.length).toEqual(2); // headers + 1 application

        const firstApplicationSheet = plenarySheetData[1];
        expect(firstApplicationSheet.length).toEqual(10); // application ID, first/last name, body name, 3 plenary seconds, 3 plenary total, avg

        expect(firstApplicationSheet[0]).toEqual(application.id);
        expect(firstApplicationSheet[1]).toEqual(application.first_name + ' ' + application.last_name);
        expect(firstApplicationSheet[2]).toEqual(application.body_name);
        expect(firstApplicationSheet[3]).toEqual(3600.0.toFixed(2)); // first plenary in seconds
        expect(firstApplicationSheet[4]).toEqual(3600.0.toFixed(2)); // second plenary in seconds
        expect(firstApplicationSheet[5]).toEqual(0.0.toFixed(2)); // third plenary in seconds
        expect(firstApplicationSheet[6]).toEqual('100.00%'); // first plenary in percents
        expect(firstApplicationSheet[7]).toEqual('100.00%');// second plenary in percents
        expect(firstApplicationSheet[8]).toEqual('0.00%'); // third plenary in percents
        expect(firstApplicationSheet[9]).toEqual('66.67%'); // average
    });

    test('should calculate the average time for bodies', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const firstPlenary = await generator.createPlenary({
            name: 'First',
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(1, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);

        const secondPlenary = await generator.createPlenary({
            name: 'Second',
            starts: moment().add(2, 'week').toDate(),
            ends: moment().add(2, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);

        const thirdPlenary = await generator.createPlenary({
            name: 'Third',
            starts: moment().add(2, 'week').toDate(),
            ends: moment().add(2, 'week').add(1, 'hour').toDate(), // so the plenary is 3600 seconds
        }, event);

        // 3 applications from body, one attended everything, 2nd and 3rd - nothing
        const application = await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 1,
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id
        }, event);

        await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 2,
            user_id: 1337,
            body_id: regularUser.bodies[0].id
        }, event);

        await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 3,
            user_id: 1338,
            body_id: regularUser.bodies[0].id
        }, event);

        // all plenaries are fully attended
        await generator.createAttendance({
            application_id: application.id,
            starts: moment(firstPlenary.starts).subtract(1, 'minute').toDate(),
            ends: moment(firstPlenary.ends).add(1, 'minute').toDate(),
        }, firstPlenary);

        await generator.createAttendance({
            application_id: application.id,
            starts: moment(secondPlenary.starts).subtract(1, 'minute').toDate(),
            ends: moment(secondPlenary.ends).add(1, 'minute').toDate(),
        }, secondPlenary);

        await generator.createAttendance({
            application_id: application.id,
            starts: moment(secondPlenary.starts).subtract(1, 'minute').toDate(),
            ends: moment(secondPlenary.ends).add(1, 'minute').toDate(),
        }, thirdPlenary);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(5); // 1 general + + 1 bodies + 3 plenaries

        const bodiesSheets = data[1];
        const bodiesSheetsData = bodiesSheets.data;

        // finding the row with the body
        const row = bodiesSheetsData.find(data => data[2] === regularUser.bodies[0].name);
        expect(row).toBeTruthy();
        expect(row.length).toEqual(9); // body ID, code, name, type, delegates count, avg%, 3 delegates %

        expect(row[0]).toEqual(regularUser.bodies[0].id);
        expect(row[1]).toEqual(regularUser.bodies[0].legacy_key);
        expect(row[2]).toEqual(regularUser.bodies[0].name);
        expect(row[3]).toEqual(regularUser.bodies[0].type);
        expect(row[4]).toEqual(3); // 3 delegates
        expect(row[5]).toEqual(33.33.toFixed(2) + '%'); // avg% for all
        expect(row[6]).toEqual(100.0.toFixed(2) + '%'); // avg% for 1st delegate (100%)
        expect(row[7]).toEqual(0.0.toFixed(2) + '%'); // avg% for 2st delegate (0%)
        expect(row[8]).toEqual(0.0.toFixed(2) + '%'); // avg% for 3st delegate (0%)
    });

    test('should not display non A/CAs on bodies stats', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(2); // 1 general + 1 bodies

        const bodiesSheets = data[1];
        const bodiesSheetsData = bodiesSheets.data;

        // finding the row with the body
        const row = bodiesSheetsData.find(data => data[2] === regularUser.bodies[1].name); // Chair Team, not A/CA
        expect(row).toBeFalsy();
    });
});
