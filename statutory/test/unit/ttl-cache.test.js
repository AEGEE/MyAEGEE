const tk = require('timekeeper');

const createTtlCache = require('../../lib/ttl_cache');

describe('TTL cache', () => {
    afterEach(() => {
        tk.reset();
    });

    test('returns a value until it expires', () => {
        const cache = createTtlCache({ ttlMs: 1000, maxSize: 10 });
        cache.set('a', 1);

        expect(cache.get('a')).toEqual(1);

        tk.travel(Date.now() + 1000);
        expect(cache.get('a')).toEqual(undefined);
        expect(cache.size).toEqual(0);
    });

    test('returns nothing for an unknown key', () => {
        const cache = createTtlCache({ ttlMs: 1000, maxSize: 10 });

        expect(cache.get('a')).toEqual(undefined);
    });

    test('starts the time again when a key is set again', () => {
        const cache = createTtlCache({ ttlMs: 1000, maxSize: 10 });
        cache.set('a', 1);
        tk.travel(Date.now() + 600);
        cache.set('a', 2);
        tk.travel(Date.now() + 600);

        expect(cache.get('a')).toEqual(2);
    });

    test('removes expired entries first when it is full', () => {
        const cache = createTtlCache({ ttlMs: 1000, maxSize: 2 });
        cache.set('old', 1);
        tk.travel(Date.now() + 600);
        cache.set('fresh', 2);
        tk.travel(Date.now() + 600); // 'old' expired, 'fresh' did not

        cache.set('new', 3);

        expect(cache.size).toEqual(2);
        expect(cache.get('fresh')).toEqual(2);
        expect(cache.get('new')).toEqual(3);
    });

    test('removes the oldest entry when it is full of fresh entries', () => {
        const cache = createTtlCache({ ttlMs: 1000, maxSize: 2 });
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);

        expect(cache.size).toEqual(2);
        expect(cache.get('a')).toEqual(undefined);
        expect(cache.get('b')).toEqual(2);
        expect(cache.get('c')).toEqual(3);
    });

    test('can be cleared', () => {
        const cache = createTtlCache({ ttlMs: 1000, maxSize: 10 });
        cache.set('a', 1);
        cache.clear();

        expect(cache.size).toEqual(0);
    });
});
