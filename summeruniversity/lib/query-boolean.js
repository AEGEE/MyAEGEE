// Converts 'true' and 'false' in the query string to booleans, recursively
// through nested objects and arrays, like the express-query-boolean package
// this replaces. Express 5 exposes req.query as a getter that re-parses the
// query string on every access, so the converted copy is defined as an own
// property; code that adjusts req.query afterwards keeps its changes.

function parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (Array.isArray(value)) return value.map(parseValue);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, parseValue(item)]));
    }
    return value;
}

module.exports = () => (req, res, next) => {
    Object.defineProperty(req, 'query', {
        value: parseValue(req.query),
        writable: true,
        enumerable: true,
        configurable: true,
    });
    next();
};

module.exports.parseValue = parseValue;
