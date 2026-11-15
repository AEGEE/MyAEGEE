const { faker } = require('@faker-js/faker');

// Seed faker per test from the run's seed and the test's name, so a test gets the
// same random data whether it runs with its whole file or alone (`-t`).
const hash = (string) => {
    let result = 0;
    for (const char of string) {
        result = ((result * 31) + char.charCodeAt(0)) % 2147483647;
    }
    return result;
};

beforeEach(() => {
    faker.seed(hash(`${process.env.FAKER_SEED}:${expect.getState().currentTestName}`));
});
