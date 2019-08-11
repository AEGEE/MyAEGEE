// A helper to deep-merge 2 objects.
// This is here and not in helpers.js to avoid circular modules
// loading breaking stuff.
const mergeDeep = (target, source) => {
    const isObject = (item) => item && typeof item === 'object' && !Array.isArray(item);

    const keys = [
        ...Object.keys(source),
        ...Object.getOwnPropertySymbols(source)
    ];

    for (const key of keys) {
        if (isObject(source[key])) {
            if (!target[key]) {
                Object.assign(target, { [key]: {} });
            }
            mergeDeep(target[key], source[key]);
        } else {
            Object.assign(target, { [key]: source[key] });
        }
    }

    return target;
};

module.exports = mergeDeep;
