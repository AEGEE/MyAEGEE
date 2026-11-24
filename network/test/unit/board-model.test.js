const moment = require('moment');

const { Board } = require('../../models');

const board = (options) => Board.build({
    body_id: 1,
    start_date: '2026-11-23',
    president: 1,
    secretary: 2,
    treasurer: 3,
    ...options
});

describe('Board election date', () => {
    beforeEach(() => {
        // Only the clock is fake; the validation promises run as usual.
        jest.useFakeTimers({
            now: moment('2026-11-23 00:00:00', 'YYYY-MM-DD HH:mm:ss').toDate(),
            doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should accept an election today, also at the start of the day', async () => {
        await expect(board({ elected_date: '2026-11-23' }).validate()).resolves.toBeDefined();
    });

    test('should accept an election in the past', async () => {
        await expect(board({ elected_date: '2026-11-22' }).validate()).resolves.toBeDefined();
    });

    test('should reject an election tomorrow', async () => {
        await expect(board({ elected_date: '2026-11-24' }).validate()).rejects.toMatchObject({
            errors: [expect.objectContaining({ path: 'elected_date' })]
        });
    });
});
