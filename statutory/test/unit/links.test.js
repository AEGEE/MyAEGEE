const { isWebLink } = require('../../lib/links');

describe('isWebLink', () => {
    test.each([
        null,
        undefined,
        '',
        '   ',
        'https://www.aegee.org',
        'http://www.aegee.org/path?query=1',
        'www.aegee.org',
        ' HTTPS://www.aegee.org '
    ])('should accept %j', (value) => {
        expect(() => isWebLink(value)).not.toThrow();
    });

    test.each([
        [123, 'The link should be a string.'],
        [['https://www.aegee.org'], 'The link should be a string.'],
        [{ href: 'https://www.aegee.org' }, 'The link should be a string.'],
        // eslint-disable-next-line no-script-url
        ['javascript:alert(1)', 'The link should start with http:// or https://.'],
        ['data:text/html,x', 'The link should start with http:// or https://.'],
        ['ftp://example.org', 'The link should start with http:// or https://.'],
        ['java\tscript://%0aalert(1)', 'The provided link is not a valid URL.'],
        ['https://www.aegee.org/\u0000', 'The provided link is not a valid URL.'],
        ['https://exa mple.org', 'The provided link is not a valid URL.']
    ])('should reject %j', (value, message) => {
        expect(() => isWebLink(value)).toThrow(message);
    });
});
