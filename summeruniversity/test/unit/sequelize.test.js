const realConfig = jest.requireActual('../../config');

// lib/sequelize.js reads the configuration and connects when it is loaded, so every test loads
// a fresh copy with its own configuration and a logger that records what it logs.
const loadDb = ({ postgres = realConfig.postgres } = {}) => {
    const logger = { error: jest.fn(), info: jest.fn(), debug: jest.fn() };
    let db;
    jest.isolateModules(() => {
        jest.doMock('../../config', () => ({ ...realConfig, postgres }));
        jest.doMock('../../lib/logger', () => logger);
        db = require('../../lib/sequelize'); // eslint-disable-line global-require
    });
    return { db, logger };
};

describe('Database connection', () => {
    let exit;

    beforeEach(() => {
        exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
        exit.mockRestore();
        jest.dontMock('../../config');
        jest.dontMock('../../lib/logger');
    });

    test.each(['database', 'username', 'password', 'host', 'port'])('a missing config.postgres.%s is logged and exits with 1', async (field) => {
        const postgres = { ...realConfig.postgres };
        delete postgres[field];

        const { db, logger } = loadDb({ postgres });

        expect(logger.error).toHaveBeenCalledWith({ field: `config.postgres.${field}` }, 'Missing config field');
        expect(exit).toHaveBeenCalledWith(1);
        await db.sequelize.close();
    });

    test('a complete configuration does not exit', async () => {
        const { db, logger } = loadDb();

        expect(logger.error).not.toHaveBeenCalled();
        expect(exit).not.toHaveBeenCalled();
        await db.sequelize.close();
    });

    test('a DECIMAL from Postgres is read as a number', () => {
        const { db } = loadDb();

        expect(db.Sequelize.postgres.DECIMAL.parse('12.50')).toEqual(12.5);
    });

    test('connects, logs every query at debug level, and connects again after close()', async () => {
        const { db, logger } = loadDb();

        await db.authenticate();
        expect(logger.info).toHaveBeenCalledWith({
            host: `postgres://${realConfig.postgres.host}:${realConfig.postgres.port}/${realConfig.postgres.database}`
        }, 'Connected to PostgreSQL');
        expect(logger.debug).toHaveBeenCalledWith({ query: expect.any(String) }, 'DB request');

        await db.close();
        expect(logger.info).toHaveBeenCalledWith('Closing PostgreSQL connection...');

        logger.info.mockClear();
        await db.authenticate();
        expect(logger.info).toHaveBeenCalledWith(expect.any(Object), 'Connected to PostgreSQL');
        expect(exit).not.toHaveBeenCalled();
        await db.close();
    });

    test('a database it cannot connect to is logged and exits with 1', async () => {
        // Nothing listens on port 1.
        const { db, logger } = loadDb({ postgres: { ...realConfig.postgres, port: 1 } });

        await db.authenticate();

        expect(logger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'Unable to connect to the database');
        expect(exit).toHaveBeenCalledWith(1);
        await db.close();
    });
});
