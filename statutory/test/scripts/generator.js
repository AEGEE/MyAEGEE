const { faker } = require('@faker-js/faker');
const moment = require('moment');

const {
    Event,
    Application,
    MembersList,
    PaxLimit,
    VotesPerAntenna,
    VotesPerDelegate,
    Position,
    Candidate,
    Plenary,
    Attendance,
    QuestionLine,
    Question,
    Voting,
    VotingBodyAllotment,
    VotingDelegateVote,
    VotingOption,
    Proposal
} = require('../../models');
const votingLifecycle = require('../../lib/voting_lifecycle');

const notSet = (field) => typeof field === 'undefined';

const visaFields = [
    'visa_place_of_birth',
    'visa_passport_number',
    'visa_passport_issue_date',
    'visa_passport_expiration_date',
    'visa_passport_issue_authority',
    'nationality',
    'visa_embassy',
    'date_of_birth',
    'visa_street_and_house',
    'visa_postal_code',
    'visa_city',
    'visa_country'
];

// IDs and orders are never random. A random value can collide with another generated
// row on a unique constraint (applications per event/user and per body/type/order,
// candidates per position/user, memberslists per event/body, pax limits per
// body/event type), or match an ID that a test or a core mock uses on purpose
// (e.g. the user's board body), which makes tests flaky. Counters start far above
// any ID used in the tests or the mocks, so generated values never meet them.
const makeCounter = (start) => {
    let last = start;
    return () => {
        last += 1;
        return last;
    };
};
const nextUserId = makeCounter(100000);
const nextBodyId = makeCounter(200000);
const nextParticipantOrder = makeCounter(1000);

exports.generateEvent = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();
    if (notSet(options.url)) options.url = options.name.toLowerCase().replace(/ /g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    if (notSet(options.description)) options.description = faker.lorem.paragraph();
    if (notSet(options.application_period_starts)) options.application_period_starts = faker.date.future();
    if (notSet(options.application_period_ends)) options.application_period_ends = faker.date.future({ refDate: options.application_period_starts });
    if (notSet(options.board_approve_deadline)) options.board_approve_deadline = faker.date.future({ refDate: options.application_period_ends });
    if (notSet(options.participants_list_publish_deadline)) options.participants_list_publish_deadline = faker.date.future({ refDate: options.board_approve_deadline });
    if (notSet(options.memberslist_submission_deadline)) options.memberslist_submission_deadline = faker.date.future({ refDate: options.participants_list_publish_deadline });
    if (notSet(options.draft_proposal_deadline)) options.draft_proposal_deadline = faker.date.between({ from: options.application_period_starts, to: options.memberslist_submission_deadline });
    if (notSet(options.final_proposal_deadline)) options.final_proposal_deadline = faker.date.between({ from: options.draft_proposal_deadline, to: options.memberslist_submission_deadline });
    if (notSet(options.candidature_deadline)) options.candidature_deadline = faker.date.between({ from: options.application_period_starts, to: options.memberslist_submission_deadline });
    if (notSet(options.booklet_publication_deadline)) options.booklet_publication_deadline = faker.date.between({ from: options.application_period_starts, to: options.memberslist_submission_deadline });
    if (notSet(options.updated_booklet_publication_deadline)) options.updated_booklet_publication_deadline = faker.date.between({ from: options.booklet_publication_deadline, to: options.memberslist_submission_deadline });
    if (notSet(options.starts)) options.starts = faker.date.future({ refDate: options.memberslist_submission_deadline });
    if (notSet(options.ends)) options.ends = faker.date.future({ refDate: options.starts });
    if (notSet(options.fee)) options.fee = faker.number.int({ min: 0, max: 100 });
    if (notSet(options.body_id)) options.body_id = nextBodyId();
    if (notSet(options.type)) options.type = faker.helpers.arrayElement(['agora', 'epm']);

    if (notSet(options.questions)) {
        const questionsCount = faker.number.int({ min: 1, max: 6 });
        options.questions = Array.from({ length: questionsCount }, () => exports.generateQuestionForEvent());
    }

    if (notSet(options.applications)) {
        options.applications = [];
    }

    return options;
};

exports.generateQuestionForEvent = (options = {}) => {
    if (notSet(options.description)) options.description = faker.lorem.sentence();
    if (notSet(options.required)) options.required = true;
    if (notSet(options.type)) options.type = 'string';
    if (notSet(options.values) && options.type === 'select') options.values = ['First', 'Second'];

    return options;
};

exports.generateApplication = (options = {}, event = null) => {
    if (notSet(options.user_id)) options.user_id = nextUserId();
    if (notSet(options.body_id)) options.body_id = nextBodyId();
    if (notSet(options.board_comment)) options.board_comment = faker.lorem.paragraph();
    if (notSet(options.participant_type)) options.participant_type = faker.helpers.arrayElement(['delegate', 'visitor', 'observer', 'envoy']);
    if (notSet(options.participant_order)) options.participant_order = nextParticipantOrder();

    // fields taken from application
    if (notSet(options.first_name)) options.first_name = faker.lorem.sentence();
    if (notSet(options.last_name)) options.last_name = faker.lorem.sentence();
    if (notSet(options.gender)) options.gender = faker.lorem.sentence();
    if (notSet(options.body_name)) options.body_name = faker.lorem.sentence();
    if (notSet(options.notification_email)) options.notification_email = faker.internet.email();

    // visa fields
    if (notSet(options.visa_required)) options.visa_required = true;
    for (const visaField of visaFields) {
        if (notSet(options[visaField])) options[visaField] = faker.lorem.sentence();
    }

    if (notSet(options.meals)) options.meals = faker.helpers.arrayElement(['Vegetarian', 'Vegan']);
    if (notSet(options.number_of_events_visited)) options.number_of_events_visited = faker.number.int({ min: 0, max: 100 });

    if (notSet(options.answers)) {
        const answersCount = event ? event.questions.length : faker.number.int({ min: 1, max: 6 });
        options.answers = Array.from({ length: answersCount }, () => faker.lorem.sentence());
    }

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

exports.generateMembersList = (options = {}, event = null) => {
    if (notSet(options.currency)) options.currency = 'EU';
    if (notSet(options.user_id)) options.user_id = nextUserId();
    if (notSet(options.body_id)) options.body_id = nextBodyId();
    if (notSet(options.members)) {
        const membersCount = faker.number.int({ min: 1, max: 6 });
        options.members = Array.from({ length: membersCount }, () => exports.generateMembersListMember());
    }

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

exports.generateMembersListMember = (options = {}) => {
    if (notSet(options.user_id)) options.user_id = nextUserId();
    if (notSet(options.first_name)) options.first_name = faker.person.firstName();
    if (notSet(options.last_name)) options.last_name = faker.person.lastName();
    if (notSet(options.fee)) options.fee = faker.number.int({ min: 1, max: 1000 });

    return options;
};

exports.generatePaxLimit = (options = {}) => {
    if (notSet(options.body_id)) options.body_id = nextBodyId();
    if (notSet(options.delegate)) options.delegate = faker.number.int(100);
    if (notSet(options.visitor)) options.visitor = faker.number.int(100);
    if (notSet(options.observer)) options.observer = faker.number.int(100);
    if (notSet(options.envoy)) options.envoy = faker.number.int(100);
    if (notSet(options.event_type)) options.event_type = faker.helpers.arrayElement(['agora', 'epm']);

    return options;
};

exports.generatePosition = (options = {}, event = null) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();
    if (notSet(options.places)) options.places = faker.number.int({ min: 1, max: 10 });
    if (notSet(options.starts)) options.starts = faker.date.past();
    if (notSet(options.ends)) options.ends = faker.date.future();
    if (notSet(options.deleted)) options.deleted = false;
    if (notSet(options.start_term)) options.start_term = faker.date.future({ refDate: options.ends });
    if (notSet(options.end_term)) options.end_term = faker.lorem.sentence();

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

// eslint-disable-next-line default-param-last
exports.generateCandidate = (options = {}, position) => {
    if (notSet(options.user_id)) options.user_id = nextUserId();
    if (notSet(options.body_id)) options.body_id = nextBodyId();
    if (notSet(options.first_name)) options.first_name = faker.lorem.sentence();
    if (notSet(options.last_name)) options.last_name = faker.lorem.sentence();
    if (notSet(options.date_of_birth)) options.date_of_birth = moment(faker.date.past()).format('YYYY-MM-DD');
    if (notSet(options.nationality)) options.nationality = faker.lorem.sentence();
    if (notSet(options.studies)) options.studies = faker.lorem.sentence();
    if (notSet(options.body_name)) options.body_name = faker.lorem.sentence();
    if (notSet(options.languages)) {
        options.languages = Array.from(
            { length: faker.number.int({ min: 1, max: 5 }) },
            () => faker.lorem.sentence()
        );
    }
    if (notSet(options.member_since)) options.member_since = moment(faker.date.past()).format('YYYY-MM-DD');
    if (notSet(options.european_experience)) options.european_experience = faker.lorem.paragraph();
    if (notSet(options.local_experience)) options.local_experience = faker.lorem.paragraph();
    if (notSet(options.attended_agorae)) options.attended_agorae = faker.lorem.paragraph();
    if (notSet(options.attended_epm)) options.attended_epm = faker.lorem.paragraph();
    if (notSet(options.attended_conferences)) options.attended_conferences = faker.lorem.paragraph();
    if (notSet(options.related_experience)) options.related_experience = faker.lorem.paragraph();
    if (notSet(options.external_experience)) options.external_experience = faker.lorem.paragraph();
    if (notSet(options.motivation)) options.motivation = faker.lorem.paragraph();
    if (notSet(options.program)) options.program = faker.lorem.paragraph();
    if (notSet(options.agreed_to_privacy_policy)) options.agreed_to_privacy_policy = true;

    if (position && position.id) {
        options.position_id = position.id;
    }

    return options;
};

exports.generateQuestionLine = (options = {}, event = null) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

exports.generateQuestion = (options = {}, questionLine = null) => {
    if (notSet(options.text)) options.text = faker.lorem.sentence();

    if (questionLine && questionLine.id) {
        options.question_line_id = questionLine.id;
    }

    return options;
};

exports.generatePlenary = (options = {}, event = null) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();
    if (notSet(options.starts)) options.starts = faker.date.future();
    if (notSet(options.ends)) options.ends = faker.date.future({ refDate: options.starts });

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

exports.generateAttendance = (options = {}, plenary = null) => {
    if (notSet(options.starts)) options.starts = faker.date.future();
    if (notSet(options.ends)) options.ends = faker.date.future({ refDate: options.starts });

    if (plenary && plenary.id) {
        options.plenary_id = plenary.id;
    }

    return options;
};

// By default a voting opens in a day and is open for an hour, so it stays scheduled during a test.
// A new proposal voting needs a proposal on the agenda (proposal_id); createVoting makes one when it is not given.
exports.generateVoting = (options = {}, event = null) => {
    if (notSet(options.kind)) options.kind = 'rollcall';
    if (notSet(options.title)) options.title = faker.lorem.sentence();
    if (notSet(options.description)) options.description = faker.lorem.paragraph();
    // A Pre-Agora voting always needs a two-thirds majority; a proposal is never voted on with an absolute one.
    if (notSet(options.majority)) {
        options.majority = options.phase === 'pre_agora'
            ? 'two_thirds'
            : faker.helpers.arrayElement(options.kind === 'proposal' ? ['simple', 'two_thirds'] : ['simple', 'absolute', 'two_thirds']);
    }
    if (notSet(options.opens_at)) options.opens_at = moment().add(1, 'day').toDate();
    if (notSet(options.closes_at)) options.closes_at = moment(options.opens_at).add(1, 'hour').toDate();

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

// An election: a voting of kind 'election' for a position, by default for 2 seats with the
// threshold of a commission. There is no majority: the result is per candidate.
// A proposal as its proposer submits it: a title, the names of the proposers, the part of the CIA it
// changes and a link to its text. By default a part other than the Statutes or a working format.
exports.generateProposal = (options = {}, event = null) => {
    if (notSet(options.title)) options.title = faker.lorem.sentence();
    if (notSet(options.proposers)) options.proposers = faker.person.fullName() + ' on behalf of AEGEE-' + faker.location.city();
    if (notSet(options.cia_part)) options.cia_part = 'other';
    if (notSet(options.text_url)) options.text_url = faker.internet.url();
    if (notSet(options.created_by)) options.created_by = faker.number.int({ min: 100, max: 999 });

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

exports.generateElection = (options = {}, event = null) => {
    if (notSet(options.seats)) options.seats = 2;
    if (notSet(options.election_rule)) options.election_rule = 'commission';

    return exports.generateVoting({ kind: 'election', majority: null, ...options }, event);
};

exports.createEvent = (options = {}) => {
    return Event.create(exports.generateEvent(options), { include: [Application] });
};

exports.createApplication = (options = {}, event = null) => {
    return Application.create(exports.generateApplication(options, event));
};

exports.createMembersList = (options = {}, event = null) => {
    return MembersList.create(exports.generateMembersList(options, event));
};

exports.createPaxLimit = (options = {}) => {
    return PaxLimit.create(exports.generatePaxLimit(options));
};

exports.createPosition = (options = {}, event = null) => {
    return Position.create(exports.generatePosition(options, event), { include: [Candidate] });
};

exports.createCandidate = (options = {}, position = null) => {
    return Candidate.create(exports.generateCandidate(options, position));
};

exports.createPlenary = (options = {}, plenary = null) => {
    return Plenary.create(exports.generatePlenary(options, plenary), { include: [Attendance] });
};

exports.createAttendance = (options = {}, attendance = null) => {
    return Attendance.create(exports.generateAttendance(options, attendance));
};

exports.createQuestionLine = (options = {}, event = null) => {
    return QuestionLine.create(exports.generateQuestionLine(options, event), { include: [Question] });
};

exports.createQuestion = (options = {}, questionLine = null) => {
    return Question.create(exports.generateQuestion(options, questionLine));
};

// A delegate who is present on the event, so who can vote in a voting that opens now.
// The participant order is unique per body, so by default it is the user ID (also unique per event)
// instead of a random number that can collide.
exports.createPresentDelegate = (options = {}, event = null) => {
    return exports.createApplication({
        participant_type: 'delegate',
        participant_order: options.user_id,
        status: 'accepted',
        confirmed: true,
        registered: true,
        departed: false,
        cancelled: false,
        ...options
    }, event);
};

// A delegate of the coming Agora, before the Agora: accepted and confirmed, but not checked in yet.
// This delegate can vote in a Pre-Agora voting, not in a voting on the Agora.
exports.createUpcomingDelegate = (options = {}, event = null) => {
    return exports.createPresentDelegate({ registered: false, ...options }, event);
};

// An Agora that starts in the given number of days, so that the Pre-Agora window
// (days 14 to 9 before the Agora) is around now. The dates are set directly,
// because the deadlines of the event would otherwise all have to fit before the start.
exports.createAgoraStartingIn = async (days, options = {}) => {
    const event = await exports.createEvent({ type: 'agora', applications: [], ...options });
    await Event.sequelize.query(`
        UPDATE events SET starts = :starts, ends = :ends WHERE id = :id
    `, {
        replacements: {
            id: event.id,
            starts: moment().add(days, 'days').toDate(),
            ends: moment().add(days + 4, 'days').toDate()
        }
    });
    return event.reload();
};

// A proposal starts as submitted; with status 'on_agenda' or 'not_admitted' (and jc_reason), the JC then decides on it.
exports.createProposal = async (options = {}, event = null) => {
    const { status, jc_reason: jcReason, ...fields } = options;
    const proposal = await Proposal.create(exports.generateProposal(fields, event));
    if (status && status !== 'submitted') {
        await proposal.update({ status, jc_reason: jcReason });
    }
    return proposal;
};

// By default a proposal or a rollcall. A proposal voting without a proposal_id gets a new proposal on the
// agenda whose part of the CIA fits the majority and the phase of the voting.
exports.createVoting = async (options = {}, event = null) => {
    const fields = exports.generateVoting({ kind: faker.helpers.arrayElement(['proposal', 'rollcall']), ...options }, event);
    if (fields.kind === 'proposal' && notSet(fields.proposal_id)) {
        const statutes = fields.phase === 'pre_agora' ? fields.concerns_statutes === true : fields.majority === 'two_thirds';
        const proposal = await exports.createProposal({ status: 'on_agenda', cia_part: statutes ? 'statutes' : 'other' }, { id: fields.event_id });
        fields.proposal_id = proposal.id;
    }
    return Voting.create(fields);
};

// An election for a new position of the event, with approved candidates on the ballot in this order:
// "Candidate A", "Candidate B", and so on. By default it opens in a day, as createVoting does.
exports.createElection = async (options = {}, event = null, { candidatesCount = 3 } = {}) => {
    const position = await exports.createPosition({ places: options.seats || 2 }, event);
    const candidates = [];
    for (let index = 0; index < candidatesCount; index++) {
        candidates.push(await exports.createCandidate({
            status: 'approved',
            first_name: 'Candidate',
            last_name: String.fromCharCode(65 + index)
        }, position));
    }

    const voting = await Voting.create(exports.generateElection({ position_id: position.id, ...options }, event));
    const ballot = [];
    for (const [index, candidate] of candidates.entries()) {
        ballot.push(await VotingOption.create({
            voting_id: voting.id,
            candidate_id: candidate.id,
            label: candidate.first_name + ' ' + candidate.last_name,
            ballot_order: index + 1
        }));
    }

    return { voting, position, candidates, ballot };
};

// A voting that opened a second ago and closes in an hour, with its snapshot taken.
exports.createOpenVoting = async (options = {}, event = null) => {
    const voting = await exports.createVoting({
        opens_at: moment().subtract(1, 'second').toDate(),
        closes_at: moment().add(1, 'hour').toDate(),
        ...options
    }, event);
    return votingLifecycle.syncVoting(voting);
};

// Moves the time window of a voting into the past, as if closes_at has come.
// The voting closes on the next request that reads it (or the next job).
exports.endVotingTime = async (voting) => {
    await Voting.sequelize.query(`
        UPDATE votings
        SET opens_at = LEAST(opens_at, now() - interval '2 seconds'), closes_at = now() - interval '1 second'
        WHERE id = :id
    `, { replacements: { id: voting.id } });
    return voting.reload();
};

// Ends the time window of an open voting and closes it, so it has its result.
exports.closeVoting = async (voting) => {
    await exports.endVotingTime(voting);
    return votingLifecycle.syncVoting(voting);
};

exports.clearAll = async () => {
    // Proposals and votings point to each other (votings.proposal_id, proposals.decided_by_voting_id),
    // so they go together, in one TRUNCATE that also takes everything that points to a voting.
    await Proposal.destroy({ truncate: true, cascade: true });
    await VotingDelegateVote.destroy({ where: {}, truncate: { cascade: true } });
    await VotingBodyAllotment.destroy({ where: {}, truncate: { cascade: true } });
    await Voting.destroy({ where: {}, truncate: { cascade: true } });
    await Question.destroy({ where: {}, truncate: { cascade: true } });
    await QuestionLine.destroy({ where: {}, truncate: { cascade: true } });
    await Attendance.destroy({ where: {}, truncate: { cascade: true } });
    await Plenary.destroy({ where: {}, truncate: { cascade: true } });
    await Candidate.destroy({ where: {}, truncate: { cascade: true } });
    await Position.destroy({ where: {}, truncate: { cascade: true } });
    await VotesPerDelegate.destroy({ where: {}, truncate: { cascade: true } });
    await VotesPerAntenna.destroy({ where: {}, truncate: { cascade: true } });
    await MembersList.destroy({ where: {}, truncate: { cascade: true } });
    await Application.destroy({ where: {}, truncate: { cascade: true } });
    await Event.destroy({ where: {}, truncate: { cascade: true } });
    await PaxLimit.destroy({ where: {}, truncate: { cascade: true } });
};
