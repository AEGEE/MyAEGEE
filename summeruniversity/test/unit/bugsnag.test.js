// The Bugsnag client is configured once, when lib/bugsnag.js loads, so each test loads it
// afresh with a stand-in for @bugsnag/js.
const loadWith = (environment) => {
    const previous = process.env.NODE_ENV;
    const start = jest.fn((options) => options);
    process.env.NODE_ENV = environment;
    try {
        jest.isolateModules(() => {
            jest.doMock('@bugsnag/js', () => ({ start }));
            require('../../lib/bugsnag'); // eslint-disable-line global-require
        });
    } finally {
        process.env.NODE_ENV = previous;
    }
    return start.mock.calls[0][0];
};

describe('Bugsnag client', () => {
    test('should never report errors of end-to-end test runs', () => {
        const options = loadWith('e2e');

        expect(options.releaseStage).toEqual('e2e');
        expect(options.enabledReleaseStages).toEqual([]);
    });

    test('should report errors in other environments', () => {
        const options = loadWith('production');

        expect(options.releaseStage).toEqual('production');
        expect(options).not.toHaveProperty('enabledReleaseStages');
    });
});
