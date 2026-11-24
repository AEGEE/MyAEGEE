describe('Bugsnag client', () => {
    const env = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = env;
    });

    test.each([
        ['test', undefined],
        ['e2e', []]
    ])('should start with NODE_ENV %s and enabled release stages %p', (nodeEnv, stages) => {
        jest.isolateModules(() => {
            // eslint-disable-next-line global-require
            const Bugsnag = require('@bugsnag/js');
            const start = jest.spyOn(Bugsnag, 'start').mockReturnValue({});
            process.env.NODE_ENV = nodeEnv;

            // eslint-disable-next-line global-require
            require('../../lib/bugsnag');

            expect(start).toHaveBeenCalledTimes(1);
            expect(start.mock.calls[0][0].releaseStage).toEqual(nodeEnv);
            expect(start.mock.calls[0][0].enabledReleaseStages).toEqual(stages);
        });
    });
});
