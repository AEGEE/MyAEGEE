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
