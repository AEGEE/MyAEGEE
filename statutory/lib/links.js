// Links that the frontend shows as clickable links have to be http(s) links,
// so nobody can store a javascript: or data: link. The URL parser reads the
// link the same way browsers do, including tabs or newlines inside the scheme.
function isWebLink(value) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        return;
    }

    let url = null;
    try {
        url = typeof value === 'string' && new URL(value);
    } catch (err) {
        // Not a URL, handled below.
    }

    if (!url || !['http:', 'https:'].includes(url.protocol)) {
        throw new Error('The link should be a valid URL starting with http:// or https://.');
    }
}

module.exports = { isWebLink };
