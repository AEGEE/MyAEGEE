const getQuorumStats = require('../../lib/quorum');

describe('Quorum representation', () => {
    const deadline = Date.parse('2026-09-10T12:00:00Z');
    const event = { participants_list_publish_deadline: '2026-09-10T14:00:00+02:00' };
    const applications = [
        { body_id: 1, status: 'accepted', cancelled: false, participant_type: 'delegate' },
        { body_id: 1, status: 'accepted', cancelled: false, participant_type: 'delegate' },
        { body_id: 2, status: 'pending', cancelled: false, participant_type: 'delegate' },
        { body_id: 3, status: 'rejected', cancelled: false, participant_type: 'delegate' },
        { body_id: 4, status: 'waiting_list', cancelled: false, participant_type: 'delegate' },
        { body_id: 5, status: 'accepted', cancelled: true, participant_type: 'delegate' },
        { body_id: 6, status: 'accepted', cancelled: false, participant_type: 'observer' },
        { body_id: 7, status: 'accepted', cancelled: false, participant_type: 'envoy' },
        { body_id: 8, status: 'accepted', cancelled: false, participant_type: 'visitor' },
        { body_id: 9, status: 'accepted', cancelled: false, participant_type: null }
    ];

    test('counts each body with non-cancelled applications once before publication', () => {
        expect(getQuorumStats(applications, event, deadline - 1)).toEqual({
            accepted_only: false, body_ids: [1, 2, 3, 4, 6, 7, 8, 9]
        });
    });

    test.each([0, 1])('counts only accepted non-cancelled delegates at/after publication (%i ms)', (offset) => {
        expect(getQuorumStats(applications, event, deadline + offset)).toEqual({
            accepted_only: true, body_ids: [1]
        });
    });

    test.each([deadline - 1, deadline])('uses server time by default at %i', (now) => {
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
        try {
            expect(getQuorumStats(applications, event)).toEqual(getQuorumStats(applications, event, now));
        } finally {
            clock.mockRestore();
        }
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
