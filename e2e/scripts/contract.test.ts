// The comparison of a factory with a real answer: what counts as compared, and that a field
// nobody could compare is reported unless it is listed as a gap.
// Run: node --test scripts/   (part of `npm run lint`)
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import { compare, contractProblems, expectShape, startContractCheck } from '../support/contract.ts';

const REASON = 'core never sends this for a member';

describe('comparing a factory with a real answer', () => {
    beforeEach(startContractCheck);

    test('types that differ and fields the service lacks are differences', () => {
        const { differences } = compare({ id: 1, name: 'x', tags: ['a'], body: { id: 1 }, extra: true }, { id: '1', name: 'y', tags: [1], body: { id: 2 } });
        assert.deepEqual(differences, [
            '$.id: factory has number, service has string',
            '$.tags[0]: factory has string, service has number',
            '$.extra: missing in the service\'s response'
        ]);
    });

    test('null and empty lists are not compared, and say so', () => {
        const { differences, compared, uncompared } = compare(
            { id: 1, primary_body: null, circles: [], bodies: [{ id: 1 }], email: 'a@example.com', optional: undefined },
            { id: 2, primary_body: { id: 3 }, circles: [{ id: 4 }], bodies: [], email: null }
        );
        assert.deepEqual(differences, []);
        assert.deepEqual([...compared].sort(), ['$', '$.bodies', '$.circles', '$.id']);
        assert.deepEqual(Object.fromEntries(uncompared), {
            '$.primary_body': 'null in the factory',
            '$.circles[0]': 'an empty list in the factory',
            '$.bodies[0]': 'an empty list in the service\'s answer',
            '$.email': 'null in the service\'s answer'
        });
    });

    test('a field that no call of the test compared is a problem', () => {
        expectShape('member', { id: 1, primary_body: null, circles: [] }, { id: 2, primary_body: null, circles: [] });
        assert.deepEqual(contractProblems(), [
            'member $.primary_body was never compared (null in the factory): give both sides a value, or list it in `gaps` with the reason',
            'member $.circles[0] was never compared (an empty list in the factory): give both sides a value, or list it in `gaps` with the reason'
        ]);
    });

    test('unless another call of the same test compared it, or it is a gap with a reason', () => {
        expectShape('member', { id: 1, primary_body: null, circles: [] }, { id: 2, primary_body: null, circles: [] }, { gaps: { '$.circles[0]': REASON } });
        expectShape('member', { id: 1, primary_body: { id: 1 }, circles: [] }, { id: 2, primary_body: { id: 5 }, circles: [] }, { gaps: { '$.circles[0]': REASON } });
        assert.deepEqual(contractProblems(), []);
    });

    test('a gap covers what is below it', () => {
        expectShape('event', { organizers: [{ id: 1, comment: null }] }, { organizers: [] }, { gaps: { '$.organizers[0]': REASON } });
        assert.deepEqual(contractProblems(), []);
    });

    test('a gap that is compared after all, or names no field, has to go', () => {
        expectShape('member', { id: 1, phone: '1' }, { id: 2, phone: '2' }, { gaps: { '$.phone': REASON, '$.fax': REASON } });
        assert.deepEqual(contractProblems(), [
            'member $.phone is listed as a gap, but both sides have a value now: remove it from `gaps`',
            'member $.fax is listed as a gap, but the factory has no such field: remove it from `gaps`'
        ]);
    });

    test('an ignored path is left out with everything below it', () => {
        expectShape('permissions', { see: { 1: true }, edit: true }, { see: { 7: false, 9: true }, edit: false }, { ignore: { '$.see': 'its keys are the ids of the bodies of whoever asks' } });
        assert.deepEqual(contractProblems(), []);
    });

    test('a reason has to be one', () => {
        assert.throws(() => expectShape('member', { id: 1 }, { id: 2 }, { gaps: { '$.id': 'todo' } }), /the reason for leaving out \$\.id \("todo"\) is a placeholder/);
        assert.throws(() => expectShape('member', { id: 1 }, { id: 2 }, { ignore: { '$.id': 'x' } }), /needs at least 4 words/);
    });

    test('what one test compared does not count for the next', () => {
        expectShape('member', { id: 1, phone: '1' }, { id: 2, phone: '2' });
        startContractCheck();
        expectShape('member', { id: 1, phone: null }, { id: 2, phone: '2' });
        assert.deepEqual(contractProblems(), ['member $.phone was never compared (null in the factory): give both sides a value, or list it in `gaps` with the reason']);
    });
});
