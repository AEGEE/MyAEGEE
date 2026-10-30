const rules = require('../../lib/voting_rules');

describe('Voting rules', () => {
    describe('splitVotes', () => {
        test('divides votes equally when there is no remainder', () => {
            expect(rules.splitVotes(6, 3)).toEqual({ min_votes: 2, extra_votes: 0, max_votes: 2 });
        });

        test('gives the remainder as extra votes of one each', () => {
            expect(rules.splitVotes(5, 3)).toEqual({ min_votes: 1, extra_votes: 2, max_votes: 2 });
            expect(rules.splitVotes(4, 3)).toEqual({ min_votes: 1, extra_votes: 1, max_votes: 2 });
        });

        test('works when there are fewer votes than delegates', () => {
            expect(rules.splitVotes(1, 3)).toEqual({ min_votes: 0, extra_votes: 1, max_votes: 1 });
        });

        test('works for a body without votes', () => {
            expect(rules.splitVotes(0, 2)).toEqual({ min_votes: 0, extra_votes: 0, max_votes: 0 });
        });
    });

    describe('votesAvailable', () => {
        // A body with 5 votes and 3 delegates: minimum 1, 2 extra votes.
        const body = (counters) => ({ votes_total: 5, min_votes: 1, extra_votes: 2, votes_cast: 0, delegates_above_min: 0, ...counters });
        const delegate = (fields) => ({ max_votes: 2, submitted_at: null, ...fields });

        test('is the maximum of the delegate when nobody voted yet', () => {
            expect(rules.votesAvailable(body(), delegate())).toEqual(2);
        });

        test('is the minimum when the extra votes are used by others', () => {
            expect(rules.votesAvailable(body({ votes_cast: 4, delegates_above_min: 2 }), delegate())).toEqual(1);
        });

        test('is never more than the votes the body has left', () => {
            expect(rules.votesAvailable(body({ votes_total: 3, votes_cast: 2, delegates_above_min: 0 }), delegate())).toEqual(1);
        });

        test('is 0 after the delegate voted', () => {
            expect(rules.votesAvailable(body(), delegate({ submitted_at: new Date() }))).toEqual(0);
        });

        test('is never negative', () => {
            expect(rules.votesAvailable(body({ votes_total: 0, min_votes: 0, extra_votes: 0 }), delegate({ max_votes: 0 }))).toEqual(0);
        });
    });

    describe('percentage', () => {
        test('gives the share in percent, rounded to 2 decimals', () => {
            expect(rules.percentage(3, 6)).toEqual(50);
            expect(rules.percentage(1, 3)).toEqual(33.33);
            expect(rules.percentage(2, 3)).toEqual(66.67);
            expect(rules.percentage(6, 6)).toEqual(100);
        });

        test('is 0 when the total is 0', () => {
            expect(rules.percentage(0, 0)).toEqual(0);
        });
    });

    describe('isAccepted', () => {
        test('simple majority: more in favour than against', () => {
            expect(rules.isAccepted('simple', { in_favour: 3, against: 2, abstention: 10 })).toEqual(true);
            expect(rules.isAccepted('simple', { in_favour: 2, against: 2, abstention: 0 })).toEqual(false);
        });

        test('absolute majority: more in favour than against and abstentions together', () => {
            expect(rules.isAccepted('absolute', { in_favour: 6, against: 3, abstention: 2 })).toEqual(true);
            expect(rules.isAccepted('absolute', { in_favour: 5, against: 3, abstention: 2 })).toEqual(false);
        });

        test('two thirds majority: more than two thirds of the votes cast in favour', () => {
            expect(rules.isAccepted('two_thirds', { in_favour: 7, against: 2, abstention: 1 })).toEqual(true);
            expect(rules.isAccepted('two_thirds', { in_favour: 6, against: 2, abstention: 1 })).toEqual(false);
        });

        test('rejects when no votes are cast', () => {
            expect(rules.isAccepted('simple', { in_favour: 0, against: 0, abstention: 0 })).toEqual(false);
        });

        test('throws on an unknown majority', () => {
            expect(() => rules.isAccepted('unknown', { in_favour: 1, against: 0, abstention: 0 })).toThrow('Unknown majority');
        });
    });

    describe('quorumRequired', () => {
        test('is half of the Antennae, rounded up', () => {
            expect(rules.quorumRequired(4)).toEqual(2);
            expect(rules.quorumRequired(5)).toEqual(3);
            expect(rules.quorumRequired(1)).toEqual(1);
            expect(rules.quorumRequired(0)).toEqual(0);
        });
    });

    describe('preAgoraWindow', () => {
        test('opens at the earliest 14 days and closes at the latest 9 days before the Agora starts', () => {
            const window = rules.preAgoraWindow(new Date('2026-11-20T10:00:00.000Z'));

            expect(window.earliest_opening.toISOString()).toEqual('2026-11-06T10:00:00.000Z');
            expect(window.latest_closing.toISOString()).toEqual('2026-11-11T10:00:00.000Z');
        });
    });

    describe('preAgoraOutcome', () => {
        const voting = (fields) => ({ result: 'accepted', quorum_reached: true, concerns_statutes: false, amendment_submitted: false, ...fields });

        test('is decided when the item is accepted with quorum: binding, no new voting on the Agora', () => {
            expect(rules.preAgoraOutcome(voting())).toEqual({ outcome: 'decided', outcome_reason: null });
        });

        test.each([
            [{ quorum_reached: false }, 'no_quorum'],
            [{ result: 'rejected' }, 'rejected'],
            [{ concerns_statutes: true }, 'statutes'],
            [{ amendment_submitted: true }, 'amendment']
        ])('goes to the Agora when %j, with the reason %s', (fields, reason) => {
            expect(rules.preAgoraOutcome(voting(fields))).toEqual({ outcome: 'to_agora', outcome_reason: reason });
        });

        // When more reasons apply, the first one in this order counts:
        // no quorum, rejected, change of the Statutes, amendment.
        test('gives the first reason that applies', () => {
            const all = { quorum_reached: false, result: 'rejected', concerns_statutes: true, amendment_submitted: true };
            expect(rules.preAgoraOutcome(voting(all)).outcome_reason).toEqual('no_quorum');
            expect(rules.preAgoraOutcome(voting({ ...all, quorum_reached: true })).outcome_reason).toEqual('rejected');
            expect(rules.preAgoraOutcome(voting({ ...all, quorum_reached: true, result: 'accepted' })).outcome_reason).toEqual('statutes');
        });
    });
});
