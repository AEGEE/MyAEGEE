const moment = require('moment');

const events = require('../../lib/events');
const helpers = require('../../lib/helpers');
const { Event } = require('../../models');

// TODO: temporary file to get 100% test coverage. We'll need to see how we want to properly tackle these cases later
describe('Events coverage', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should not hide application status for missing event object', () => {
        expect(helpers.shouldHideApplicationStatus(null, {})).toEqual(false);
    });

    test('should mask statuses on /mine with missing permissions list and skip empty applications', async () => {
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
