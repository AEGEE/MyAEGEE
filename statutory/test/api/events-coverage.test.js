const moment = require('moment');

const events = require('../../lib/events');
const helpers = require('../../lib/helpers');
const { Event } = require('../../models');

// Two branches that no request can reach, called directly so that they stay covered:
// - helpers.shouldHideApplicationStatus() without an event: its three callers always have one;
// - the event without applications in listUserAppliedEvents(): the query only returns
//   events with an application of the user (the include is required).
// Everything else these tests once covered is covered through the routes (events-mine,
// events-display). The file can go when the two branches are removed from lib/.
describe('Events coverage', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should not hide application status for missing event object', () => {
        expect(helpers.shouldHideApplicationStatus(null, {})).toEqual(false);
    });

    test('should skip an event without applications on /mine', async () => {
        const findAllSpy = jest.spyOn(Event, 'findAll').mockResolvedValue([
            {
                id: 1,
                type: 'epm',
                participants_list_publish_deadline: moment().add(1, 'day').toDate(),
                application_status_revealed_at: null,
                applications: []
            },
            {
                id: 2,
                type: 'epm',
                participants_list_publish_deadline: moment().add(1, 'day').toDate(),
                application_status_revealed_at: null,
                applications: [{ user_id: 123, cancelled: false, status: 'accepted' }]
            }
        ]);

        const req = {
            user: { id: 123 },
            corePermissions: null
        };
        const res = {
            json: jest.fn((payload) => payload)
        };

        await events.listUserAppliedEvents(req, res);

        expect(findAllSpy).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledTimes(1);
        const response = res.json.mock.calls[0][0];
        expect(response.success).toEqual(true);
        expect(response.data[1].applications[0].status).toEqual('pending');
    });
});
