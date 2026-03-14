const moment = require('moment');

const helpers = require('../../lib/helpers');

describe('statutory helpers', () => {
    test('hides application status before the publish deadline without overrides', () => {
        expect(helpers.shouldHideApplicationStatus({
            participants_list_publish_deadline: moment().add(1, 'day').toDate(),
            application_status_revealed_at: null
        }, {})).toEqual(true);
    });

    test('does not hide application status after reveal time', () => {
        expect(helpers.shouldHideApplicationStatus({
            participants_list_publish_deadline: moment().add(1, 'day').toDate(),
            application_status_revealed_at: moment().subtract(1, 'hour').toDate()
        }, {})).toEqual(false);
    });

    test('does not hide application status when status-changing permission is present', () => {
        expect(helpers.shouldHideApplicationStatus({
            participants_list_publish_deadline: moment().add(1, 'day').toDate(),
            application_status_revealed_at: null
        }, { change_status: true })).toEqual(false);
    });
});
