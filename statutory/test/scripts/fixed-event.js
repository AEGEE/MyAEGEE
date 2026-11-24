// The dates of an event that do not depend on the day the tests run. A test of a deadline
// creates its event with these and freezes the clock at, just before or just after one of
// them, so it never meets a validation rule or another deadline by accident.
const DATES = {
    application_period_starts: '2030-01-07T09:00:00.000Z',
    application_period_ends: '2030-02-04T09:00:00.000Z',
    board_approve_deadline: '2030-02-11T09:00:00.000Z',
    participants_list_publish_deadline: '2030-02-18T09:00:00.000Z',
    draft_proposal_deadline: '2030-02-19T09:00:00.000Z',
    final_proposal_deadline: '2030-02-20T09:00:00.000Z',
    candidature_deadline: '2030-02-21T09:00:00.000Z',
    booklet_publication_deadline: '2030-02-22T09:00:00.000Z',
    updated_booklet_publication_deadline: '2030-02-25T09:00:00.000Z',
    memberslist_submission_deadline: '2030-03-04T09:00:00.000Z',
    // Fourteen days before the start; the event computes it, it is not stored.
    memberslist_edit_deadline: '2030-04-22T09:00:00.000Z',
    starts: '2030-05-06T09:00:00.000Z',
    ends: '2030-05-10T15:00:00.000Z'
};

// A day on which nothing of the event has begun yet.
exports.BEFORE_EVERYTHING = new Date('2029-12-03T09:00:00.000Z');

// The moment of one of the dates above, or a number of milliseconds before (negative) or after it.
exports.at = (field, offset = 0) => new Date(new Date(DATES[field]).getTime() + offset);

// The date fields for generator.generateEvent() and generator.createEvent().
exports.fixedDates = (overrides = {}) => {
    const dates = {};
    for (const field of Object.keys(DATES)) {
        if (field !== 'memberslist_edit_deadline') {
            dates[field] = new Date(DATES[field]);
        }
    }

    return { ...dates, ...overrides };
};
