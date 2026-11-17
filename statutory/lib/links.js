// Links that the frontend shows as clickable links may only be http(s) links,
// so nobody can store a javascript: or data: link. A link without a scheme
// (like www.example.org) is allowed; the frontend opens it as https.
function isWebLink(value) {
    if (value === null || value === undefined) {
        return;
    }

    if (typeof value !== 'string') {
        throw new Error('The link should be a string.');
    }

    const link = value.trim();
    if (link === '') {
        return;
    }

    // URL parsers (and browsers) drop tabs and newlines, so "java\tscript:" would
    // otherwise pass as a link without a scheme and be opened as "javascript:".
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001F\u007F]/.test(link)) {
        throw new Error('The provided link is not a valid URL.');
    }

    let url;
    try {
        url = new URL(/^[a-z][a-z\d+.-]*:/i.test(link) ? link : `https://${link}`);
    } catch (err) {
        throw new Error('The provided link is not a valid URL.');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('The link should start with http:// or https://.');
    }
}

module.exports = { isWebLink };
