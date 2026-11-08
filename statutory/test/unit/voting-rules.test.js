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
});
