describe('Process entry point', () => {
    test('should start the server', () => {
        jest.isolateModules(() => {
            const startServer = jest.fn().mockResolvedValue();
            jest.doMock('../../lib/server', () => ({ startServer }));

            require('../../lib/run'); // eslint-disable-line global-require

            expect(startServer).toHaveBeenCalledTimes(1);
        });
    });
});
