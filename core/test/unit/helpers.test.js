const helpers = require('../../lib/helpers');

describe('isRestrictedEmail', () => {
    test('should block restricted domains and their subdomains', () => {
        expect(helpers.isRestrictedEmail('test@aegee.org')).toEqual(true);
        expect(helpers.isRestrictedEmail('test@aegee.eu')).toEqual(true);
        expect(helpers.isRestrictedEmail('test@sub.aegee.org')).toEqual(true);
    });

    test('should ignore case and surrounding whitespace', () => {
        expect(helpers.isRestrictedEmail('  Test@AEGEE.Org  ')).toEqual(true);
    });

    test('should allow addresses that only look like restricted domains', () => {
        expect(helpers.isRestrictedEmail('me@notaegee.org')).toEqual(false);
        expect(helpers.isRestrictedEmail('aegee.org.fan@example.com')).toEqual(false);
        expect(helpers.isRestrictedEmail('test@aegee.org.example.com')).toEqual(false);
    });
});
