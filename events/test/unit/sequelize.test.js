// lib/sequelize.js: the configuration check on start, the DECIMAL parser, and connecting.
// Each test loads its own copy of the module with jest.isolateModules, with process.exit
// replaced, so the module that the other tests share stays connected.
const loadIsolated = (changeConfig = () => {}) => {
    let loaded;
    jest.isolateModules(() => {
        changeConfig(require('../../config')); // eslint-disable-line global-require
        const logger = require('../../lib/logger'); // eslint-disable-line global-require
        jest.spyOn(logger, 'error').mockImplementation(() => {});
        jest.spyOn(logger, 'info').mockImplementation(() => {});
        loaded = { db: require('../../lib/sequelize'), logger }; // eslint-disable-line global-require
    });
    return loaded;
};

describe('Database connection', () => {
    let exit;

    beforeEach(() => {
        exit = jest.spyOn(process, 'exit').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test.each(['database', 'username', 'password', 'host', 'port'])('exits with 1 when config.postgres.%s is missing', (field) => {
        const { logger } = loadIsolated((config) => {
            delete config.postgres[field];
        });

        expect(logger.error).toHaveBeenCalledWith({ field: 'config.postgres.' + field }, 'Missing config field');
        expect(exit).toHaveBeenCalledWith(1);
    });

    test('reads a DECIMAL as a number', () => {
        const { db } = loadIsolated();

        expect(db.Sequelize.postgres.DECIMAL.parse('2.50')).toEqual(2.5);
    });

    test('connects again after it was closed', async () => {
        const { db, logger } = loadIsolated();

        await db.close();
        await db.authenticate();

        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ host: expect.any(String) }), 'Connected to PostgreSQL');
        expect(exit).not.toHaveBeenCalled();
        await db.close();
    });

    test('exits with 1 when it cannot connect', async () => {
        const { db, logger } = loadIsolated();
        const failure = new Error('Connection refused');
        jest.spyOn(db.sequelize, 'authenticate').mockRejectedValueOnce(failure);

        await db.authenticate();

        expect(logger.error).toHaveBeenCalledWith({ err: failure }, 'Unable to connect to the database');
        expect(exit).toHaveBeenCalledWith(1);
        await db.close();
    });
});
