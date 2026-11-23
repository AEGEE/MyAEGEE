// The error reporting client is set up when it is loaded, from the environment.
describe('Bugsnag client', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.dontMock('@bugsnag/js');
    });

    const startOptionsIn = (env) => {
        let start;
        process.env.NODE_ENV = env;
        jest.isolateModules(() => {
            start = jest.fn().mockReturnValue({});
            jest.doMock('@bugsnag/js', () => ({ start }));

            require('../../lib/bugsnag'); // eslint-disable-line global-require
        });

        return start.mock.calls[0][0];
    };

    test('should report under the environment the service runs in', () => {
        const options = startOptionsIn('test');

        expect(options.releaseStage).toEqual('test');
        expect(options).not.toHaveProperty('enabledReleaseStages');
    });

    test('should never report from an end-to-end test run', () => {
        const options = startOptionsIn('e2e');

        expect(options.releaseStage).toEqual('e2e');
        expect(options.enabledReleaseStages).toEqual([]);
    });
});
