const helpers = require('../../lib/helpers');

describe('network helpers', () => {
    test('allows only known board sorting fields', () => {
        expect(helpers.getSorting({ sort: 'start_date', direction: 'desc' })).toEqual([['start_date', 'desc']]);
        expect(helpers.getSorting({ sort: 'created_at', direction: 'desc' })).toEqual([['id', 'desc']]);
        expect(helpers.getSorting({ sort: 'start_date;drop table boards', direction: 'asc' })).toEqual([['id', 'asc']]);
    });

    test('returns all-false permissions when permission payloads are missing', () => {
        expect(helpers.getPermissions({ bodies: [{ id: 1 }] }, undefined, undefined)).toEqual({
            view_board: false,
            manage_antenna_criteria: false,
            manage_netcom_assignment: false,
            send_mails: false,
            manage_boards: { 1: false, global: false },
            antenna_criteria: {
                communication: false,
                communication_exception: false,
                board_election: false,
                members_list: false,
                membership_fee: false,
                events: false,
                agora_attendance: false,
                development_plan: false,
                fulfilment_report: false
            }
        });
    });
});
