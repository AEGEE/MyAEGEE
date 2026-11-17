const { isWebLink } = require('../../lib/links');

describe('isWebLink', () => {
    test.each([
        null,
        undefined,
        '',
        '   ',
        'https://www.aegee.org',
        'http://www.aegee.org:8080/path?query=1',
        ' HTTPS://www.aegee.org '
    ])('should accept %j', (value) => {
        expect(() => isWebLink(value)).not.toThrow();
    });

    test.each([
        123,
        ['https://www.aegee.org'],
        'www.aegee.org',
        // eslint-disable-next-line no-script-url
        'javascript:alert(1)',
        'java\tscript:alert(1)',
        '\u0001javascript:alert(1)',
        'data:text/html,x',
        'ftp://example.org',
        'https://exa mple.org'
    ])('should reject %j', (value) => {
        expect(() => isWebLink(value)).toThrow('The link should be a valid URL starting with http:// or https://.');
    });
});
