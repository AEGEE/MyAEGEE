describe('Entry point', () => {
    afterEach(() => {
        jest.dontMock('../../lib/server');
    });

    test('should start the server once', () => {
        const startServer = jest.fn().mockResolvedValue();

        jest.isolateModules(() => {
            // The real server module is not loaded: nothing listens and nothing connects.
            jest.doMock('../../lib/server', () => ({ startServer }));
            require('../../lib/run'); // eslint-disable-line global-require
        });

        expect(startServer).toHaveBeenCalledTimes(1);
        expect(startServer).toHaveBeenCalledWith();
    });
});
