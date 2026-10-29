// A small in-memory cache where every entry expires after a fixed time.
// It never holds more than maxSize entries: when it is full, it first removes the expired
// entries and then, if still full, the oldest one (a Map keeps insertion order).
module.exports = ({ ttlMs, maxSize }) => {
    const entries = new Map();

    return {
        get(key) {
            const entry = entries.get(key);
            if (!entry) return undefined;

            if (entry.expiresAt <= Date.now()) {
                entries.delete(key);
                return undefined;
            }

            return entry.value;
        },

        set(key, value) {
            entries.delete(key);

            if (entries.size >= maxSize) {
                for (const [entryKey, entry] of entries) {
                    if (entry.expiresAt <= Date.now()) entries.delete(entryKey);
                }
            }

            if (entries.size >= maxSize) {
                entries.delete(entries.keys().next().value);
            }

            entries.set(key, { value, expiresAt: Date.now() + ttlMs });
        },

        get size() {
            return entries.size;
        },

        clear() {
            entries.clear();
        }
    };
};
