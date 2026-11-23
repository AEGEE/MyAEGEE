const { PaxLimit } = require('../../models');

// null is no limit. What each type of body may send when no limit is stored for it.
const NONE = { delegate: 0, envoy: 0, visitor: 0, observer: 0 };

describe('Default participants limits', () => {
    test.each([
        ['antenna', { delegate: 3, envoy: 0, visitor: 30, observer: 0 }],
        ['contact antenna', { delegate: 0, envoy: 3, visitor: 30, observer: 0 }],
        ['contact', { delegate: 0, envoy: 0, visitor: 0, observer: null }],
        ['partner', { delegate: 0, envoy: 3, visitor: 0, observer: 0 }],
        ['working group', { delegate: 0, envoy: 3, visitor: 30, observer: 0 }],
        ['committee', { delegate: 0, envoy: 3, visitor: 30, observer: 0 }],
        ['project', { delegate: 0, envoy: 3, visitor: 30, observer: 0 }],
        ['interest group', { delegate: 0, envoy: 0, visitor: 30, observer: 0 }],
        ['commission', NONE],
        [undefined, NONE]
    ])('should give a body of type %p its limit for an Agora', (type, expected) => {
        const limit = PaxLimit.getDefaultForBody({ id: 34, type }, 'agora');

        expect(limit.toJSON()).toMatchObject({ ...expected, body_id: 34, event_type: 'agora', default: true });
        expect(limit.hasAnyLimits()).toEqual(expected !== NONE);
    });

    // An SPM takes the limits of an EPM.
    describe.each(['epm', 'spm'])('for an %s', (eventType) => {
        test.each(['antenna', 'contact antenna', 'contact'])('should let a body of type %p send any number of envoys', (type) => {
            const limit = PaxLimit.getDefaultForBody({ id: 34, type }, eventType);

            expect(limit.toJSON()).toMatchObject({ delegate: 0, envoy: null, visitor: 0, observer: 0, body_id: 34, event_type: eventType, default: true });
            expect(limit.hasAnyLimits()).toEqual(true);
        });

        test.each(['partner', 'working group', 'committee', 'project', 'interest group', 'commission', undefined])('should let a body of type %p send nobody', (type) => {
            const limit = PaxLimit.getDefaultForBody({ id: 34, type }, eventType);

            expect(limit.toJSON()).toMatchObject({ ...NONE, body_id: 34, event_type: eventType, default: true });
            expect(limit.hasAnyLimits()).toEqual(false);
        });
    });
});
