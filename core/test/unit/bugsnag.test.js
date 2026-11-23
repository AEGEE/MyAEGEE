// The Bugsnag client reports nothing from test runs and end-to-end runs, and everything else.
describe('Bugsnag client', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.resetModules();
        jest.dontMock('@bugsnag/js');
    });

    const startWith = (env) => {
        let options;

        process.env.NODE_ENV = env;
        jest.isolateModules(() => {
            jest.doMock('@bugsnag/js', () => ({
                start: (given) => {
                    options = given;
                    return { notify: () => {} };
                }
            }));

            // eslint-disable-next-line global-require
            require('../../lib/bugsnag');
        });

        return options;
    };

    test.each(['test', 'e2e'])('should report nothing in the %s environment', (env) => {
        const options = startWith(env);

        expect(options.releaseStage).toEqual(env);
        expect(options.enabledReleaseStages).toEqual([]);
    });

    test('should report in production', () => {
        const options = startWith('production');

        expect(options.releaseStage).toEqual('production');
        expect(options).not.toHaveProperty('enabledReleaseStages');
    });
});
