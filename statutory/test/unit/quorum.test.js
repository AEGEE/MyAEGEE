const getQuorumStats = require('../../lib/quorum');

describe('Quorum representation', () => {
    const deadline = Date.parse('2026-09-10T12:00:00Z');
    const event = { participants_list_publish_deadline: '2026-09-10T14:00:00+02:00' };
    const applications = [
        { body_id: 1, status: 'accepted', cancelled: false },
        { body_id: 1, status: 'accepted', cancelled: false },
        { body_id: 2, status: 'pending', cancelled: false },
        { body_id: 3, status: 'rejected', cancelled: false },
        { body_id: 4, status: 'waiting_list', cancelled: false },
        { body_id: 5, status: 'accepted', cancelled: true }
    ];

    test('counts each body with non-cancelled applications once before publication', () => {
        expect(getQuorumStats(applications, event, deadline - 1)).toEqual({
            accepted_only: false, body_ids: [1, 2, 3, 4]
        });
    });

    test.each([0, 1])('counts only accepted non-cancelled applications at/after publication (%i ms)', (offset) => {
        expect(getQuorumStats(applications, event, deadline + offset)).toEqual({
            accepted_only: true, body_ids: [1]
        });
    });

    test('an early status reveal does not move the quorum cutoff', () => {
        expect(getQuorumStats(applications, {
            ...event, application_status_revealed_at: '2026-09-01T00:00:00Z'
        }, deadline - 1).accepted_only).toBe(false);
    });

    test.each([deadline - 1, deadline])('handles no applications at %i', (now) => {
        expect(getQuorumStats([], event, now).body_ids).toEqual([]);
        expect(getQuorumStats(applications.filter((app) => app.cancelled), event, now).body_ids).toEqual([]);
    });
});
