const log = require('../../lib/logger');

describe('Unhandled rejection log', () => {
    let handler;

    beforeAll(() => {
        const before = process.listeners('unhandledRejection');
        require('../../lib/server'); // eslint-disable-line global-require
        // The service's own handler, among the listeners its dependencies may add.
        handler = process.listeners('unhandledRejection')
            .find((listener) => !before.includes(listener) && String(listener).includes('Unhandled rejection'));
    });

    afterAll(() => {
        process.removeListener('unhandledRejection', handler);
    });

    test('should log the error through the error serializer', () => {
        const errorLog = jest.spyOn(log, 'error').mockImplementation(() => {});
        const err = new Error('Query failed');

        handler(err);

        expect(errorLog).toHaveBeenCalledWith({ err }, 'Unhandled rejection');
        errorLog.mockRestore();
    });
});
