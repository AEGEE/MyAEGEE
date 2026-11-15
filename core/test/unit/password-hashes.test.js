const { User } = require('../../models');

// Hashes generated with bcrypt 5.1.1 for 'correct horse battery staple'. Stored
// passwords must keep verifying after bcrypt upgrades, including '$2a$' hashes
// from older libraries.
const PASSWORD = 'correct horse battery staple';
const LEGACY_HASHES = {
    '$2a$ (cost 10)': '$2a$10$jZ8LlrFcK66qDHjJ44odd.UHgXWrWFfuW9HiFmEiBiLdhCI9jsCL2',
    '$2b$ (cost 10)': '$2b$10$Oay6qjyY0fk1IJ6kW0npWe3k67VSe.8QQfkWLFmRQA1u6E.idhHJO',
    '$2b$ (cost 4)': '$2b$04$V3b6M90j9BiPtX1x/cK75OPPwD3ulcRFoYV6ocsfCbDidWS6xx8hq',
};

describe('Password hashes', () => {
    for (const [label, hash] of Object.entries(LEGACY_HASHES)) {
        test(`should accept the right password for an existing ${label} hash`, async () => {
            const user = User.build({ password: hash });
            expect(await user.checkPassword(PASSWORD)).toEqual(true);
        });

        test(`should reject a wrong password for an existing ${label} hash`, async () => {
            const user = User.build({ password: hash });
            expect(await user.checkPassword('wrong password')).toEqual(false);
        });
    }
});
