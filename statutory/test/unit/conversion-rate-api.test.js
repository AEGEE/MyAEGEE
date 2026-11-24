const { default: nock } = require('nock');

const config = require('../../config');
const { MembersList } = require('../../models');
const conversionRates = require('../assets/conversion-rates-api.json');

// The host of the currency conversion rates is a configuration value, so that a test
// stack can point it at a stub instead of the European Commission's server.
describe('Currency conversion rates host', () => {
    const originalHost = config.conversion_rate_api && config.conversion_rate_api.host;

    afterEach(() => {
        nock.cleanAll();
        config.conversion_rate_api.host = originalHost;
        delete process.env.CONVERSION_RATE_API_HOST;
    });

    const loadConfig = () => {
        let loaded;
        jest.isolateModules(() => {
            // eslint-disable-next-line global-require
            loaded = require('../../config');
        });
        return loaded;
    };

    test('should be the European Commission\'s server by default', () => {
        expect(loadConfig().conversion_rate_api.host).toEqual('https://ec.europa.eu');
    });

    test('should be taken from CONVERSION_RATE_API_HOST if set', () => {
        process.env.CONVERSION_RATE_API_HOST = 'http://localhost:18091';

        expect(loadConfig().conversion_rate_api.host).toEqual('http://localhost:18091');
    });

    test('should be where a memberslist takes its conversion rate from', async () => {
        config.conversion_rate_api.host = 'http://conversion-rates.test:18091';
        const stub = nock('http://conversion-rates.test:18091')
            .get('/budg/inforeuro/api/public/monthly-rates')
            .reply(200, conversionRates);

        // Only the hook that sets the conversion rate runs, nothing is saved.
        const memberslist = MembersList.build({ currency: 'EU', members: [] });
        const options = { fields: [] };
        await MembersList.runHooks('beforeSave', memberslist, options);

        expect(stub.isDone()).toEqual(true);
        expect(options.fields).toContain('conversion_rate');
        expect(memberslist.conversion_rate).toEqual(conversionRates.find((rate) => rate.isoA2Code === 'BE').value);
    });
});
