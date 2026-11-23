const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const logger = require('../../lib/logger');
const { Position } = require('../../models');
const mails = require('../assets/core-notification-mails.json').data;
const regularUser = require('../assets/core-valid.json').data;

// Values that stand for personal data and for whole records, which must not reach the log.
const FIRST_NAME = 'log-marker-first-name';
const LAST_NAME = 'log-marker-last-name';
const POSITION_NAME = 'log-marker-position';
const PLENARY_NAME = 'log-marker-plenary';

// The mass mailer and the background jobs log what they did and for which record,
// not who the mail went to and not the records themselves.
describe('Logs of the mass mailer and the background jobs', () => {
    let spies;

    // Everything that was logged, as the logger would write it.
    const logged = () => spies
        .flatMap((spy) => spy.mock.calls)
        .map((args) => JSON.stringify(args));

    const loggedFields = (message) => spies
        .flatMap((spy) => spy.mock.calls)
        .filter((args) => args[args.length - 1] === message)
        .map((args) => args[0]);

    const expectNothingPersonalLogged = () => {
        const lines = logged();
        expect(lines.length).toBeGreaterThan(0);

        for (const line of lines) {
            for (const marker of [FIRST_NAME, LAST_NAME, POSITION_NAME, PLENARY_NAME, ...mails.map((mail) => mail.notification_email)]) {
                expect(line).not.toContain(marker);
            }
        }
    };

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        mock.cleanAll();
        await generator.clearAll();
        cron.clearAll();
    });

    const spyOnLogger = () => {
        spies = ['debug', 'info', 'warn', 'error'].map((level) => jest.spyOn(logger, level));
    };

    test('should not log the recipients of a mass mail', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        for (const userId of [1, 2, 3]) {
            await generator.createApplication({
                user_id: userId,
                body_id: regularUser.bodies[0].id,
                first_name: FIRST_NAME,
                last_name: LAST_NAME
            }, event);
        }
        // Core does not know this user, which is logged as well.
        const unknown = await generator.createApplication({ user_id: 1337, first_name: FIRST_NAME, last_name: LAST_NAME }, event);

        spyOnLogger();
        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { subject: 'Testing', text: 'Hello {first_name} {last_name}.' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.meta.sent).toEqual(3);

        expectNothingPersonalLogged();
        expect(loggedFields('Sending mass mailer to users')).toEqual([{ count: 4 }]);
        expect(loggedFields('Could not find user')).toEqual([{ user_id: unknown.user_id }]);
        expect(loggedFields('Prepared letters')).toEqual([{ count: 3 }]);
    });

    describe('background jobs', () => {
        let event;

        // Runs a job of the given type for the record right away.
        const runJob = async (type, id) => {
            const jobId = cron.addJob(type, moment().add(1, 'week').toDate(), { id });
            await cron.executeJob(jobId);
        };

        const createPosition = async (status) => {
            const position = await generator.createPosition({
                name: POSITION_NAME,
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);
            await generator.createCandidate({ first_name: FIRST_NAME, last_name: LAST_NAME }, position);
            await Position.update({ status }, { where: { id: position.id }, hooks: false });
            cron.clearAll();

            return position;
        };

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', applications: [] });
        });

        test('should log only the id when closing the applications for a position', async () => {
            const position = await createPosition('open');

            spyOnLogger();
            await runJob(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, position.id);

            expect((await Position.findByPk(position.id)).status).toEqual('closed');
            expectNothingPersonalLogged();
            expect(loggedFields('Closing applications for position: Successfully closed deadline for position'))
                .toEqual([{ position_id: position.id }]);
        });

        test('should log only the id and the status when a position is closed already', async () => {
            const position = await createPosition('closed');

            spyOnLogger();
            await runJob(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, position.id);

            expectNothingPersonalLogged();
            expect(loggedFields('Closing applications for position: Position status is not open.'))
                .toEqual([{ position_id: position.id, status: 'closed' }]);
        });

        test('should log only the id when opening the applications for a position', async () => {
            const position = await createPosition('closed');

            spyOnLogger();
            await runJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, position.id);

            expect((await Position.findByPk(position.id)).status).toEqual('open');
            expectNothingPersonalLogged();
            expect(loggedFields('Opening applications for position: Successfully opened deadline for position'))
                .toEqual([{ position_id: position.id }]);
        });

        test('should log only the id and the status when a position is open already', async () => {
            const position = await createPosition('open');

            spyOnLogger();
            await runJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, position.id);

            expectNothingPersonalLogged();
            expect(loggedFields('Opening applications for position: Position status is not closed.'))
                .toEqual([{ position_id: position.id, status: 'open' }]);
        });

        test('should log only the id when closing the attendances of a plenary', async () => {
            const plenary = await generator.createPlenary({ name: PLENARY_NAME }, event);
            cron.clearAll();

            spyOnLogger();
            await runJob(cron.JOB_TYPES.CLOSE_ATTENDANCES, plenary.id);

            expectNothingPersonalLogged();
            expect(loggedFields('Closing attendances for plenary: Successfully closed attendances for plenary'))
                .toEqual([{ plenary_id: plenary.id }]);
        });
    });
});
