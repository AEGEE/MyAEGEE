// lib/bugsnag.js starts the client when it is first loaded, with the release stage taken from
// NODE_ENV.
describe('Bugsnag client', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    const startOptionsWith = (nodeEnv) => {
        process.env.NODE_ENV = nodeEnv;
        let start;
        jest.isolateModules(() => {
            const Bugsnag = require('@bugsnag/js'); // eslint-disable-line global-require
            start = jest.spyOn(Bugsnag, 'start').mockReturnValue({});

            require('../../lib/bugsnag'); // eslint-disable-line global-require
        });

        expect(start).toHaveBeenCalledTimes(1);
        return start.mock.calls[0][0];
    };

    test('should report nothing from end-to-end test runs', () => {
        const options = startOptionsWith('e2e');

        expect(options.releaseStage).toEqual('e2e');
        expect(options.enabledReleaseStages).toEqual([]);
    });

    test('should report from production without limiting the release stages', () => {
        const options = startOptionsWith('production');

        expect(options.releaseStage).toEqual('production');
        expect(options).not.toHaveProperty('enabledReleaseStages');
    });
});
