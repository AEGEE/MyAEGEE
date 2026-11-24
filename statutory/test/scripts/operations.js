const path = require('path');
const moment = require('moment');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { request } = require('./helpers');
const generator = require('./generator');
const regularUser = require('../assets/core-valid.json').data;

// The operations of openapi.yaml with one valid request each, for the table-driven sweeps
// (authentication-required and path-parameters): a new route gets its rows there without
// anyone writing them, and fails them until it has a request here.
const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });

exports.spec = spec;
exports.operations = listOperations(spec);

// The operations that take a JSON body, with the schema of that body.
exports.jsonBodyOperations = exports.operations
    .map((operation) => {
        const { requestBody } = spec.paths[operation.template][operation.method.toLowerCase()];
        const json = requestBody && requestBody.content && requestBody.content['application/json'];
        return json ? { ...operation, bodySchema: json.schema } : null;
    })
    .filter(Boolean);

// Everything statutory asks core about, so that only the request itself decides the answer.
exports.ALL_PERMISSIONS = [
    'global:manage_event:agora',
    'global:apply:agora',
    'global:manage_applications:agora',
    'global:manage_incoming:agora',
    'global:manage_juridical:agora',
    'global:update_memberslist_status:agora',
    'global:approve_members:agora',
    'global:use_massmailer:agora',
    'global:manage_memberslist:agora',
    'global:see_memberslists:agora',
    'global:see_missing_memberslists:agora',
    'global:see_memberslists_without_fee:agora',
    'global:set_memberslists_fee_paid:agora',
    'global:manage_candidates:agora',
    'global:manage_plenaries:agora',
    'global:see_plenaries:agora',
    'global:mark_attendance:agora',
    'global:manage_question_lines:agora',
    'global:see_question_lines:agora',
    'global:see_background_tasks:statutory',
    'global:update_application_ban:member'
];

const image = () => ({ files: { image: { path: './test/assets/valid_image.png' } } });

// What each operation is sent besides its path: a body, an upload or a query that the
// operation accepts from a caller who may use it. Operations without an entry take none.
const requests = {
    createEvent: () => ({ body: generator.generateEvent({ type: 'agora' }) }),
    setPaxLimit: (fixtures) => ({ body: { body_id: fixtures.body.id, delegate: 3, envoy: 0, observer: 0, visitor: 10 } }),
    updateEvent: () => ({ body: { name: 'A new name' } }),
    setEventStatus: () => ({ body: { status: 'draft' } }),
    uploadEventImage: image,
    submitApplication: (fixtures) => ({ body: generator.generateApplication({ body_id: fixtures.body.id }, fixtures.event) }),
    exportApplications: () => ({ query: { select: ['first_name', 'last_name'] } }),
    setBoardviewApplications: (fixtures) => ({
        body: [{ user_id: fixtures.application.user_id, participant_type: 'delegate', participant_order: 1 }]
    }),
    setApplicationCancelled: () => ({ body: { cancelled: true } }),
    setApplicationAttended: () => ({ body: { attended: true } }),
    setApplicationRegistered: () => ({ body: { registered: true } }),
    setApplicationDeparted: () => ({ body: { departed: false } }),
    setApplicationConfirmed: () => ({ body: { confirmed: true } }),
    setApplicationIncoming: () => ({ body: { incoming: true } }),
    setApplicationIsOnMemberslist: () => ({ body: { is_on_memberslist: true } }),
    setApplicationStatus: () => ({ body: { status: 'accepted' } }),
    setApplicationBoard: () => ({ body: { board_comment: 'A new comment' } }),
    updateApplication: () => ({ body: { nationality: 'A new nationality' } }),
    uploadMemberslist: () => ({ body: { currency: 'EU', members: [generator.generateMembersListMember()] } }),
    setMemberslistFeePaid: () => ({ body: { fee_paid: 10 } }),
    sendMassMail: () => ({ body: { subject: 'A subject', text: 'Dear {first_name}' } }),
    createPosition: () => ({ body: generator.generatePosition() }),
    setPositionStatus: () => ({ body: { status: 'closed' } }),
    updatePosition: () => ({ body: { name: 'A new name' } }),
    createQuestionLine: () => ({ body: generator.generateQuestionLine() }),
    setQuestionLineStatus: () => ({ body: { status: 'closed' } }),
    updateQuestionLine: () => ({ body: { name: 'A new name' } }),
    submitQuestion: () => ({ body: generator.generateQuestion() }),
    updateQuestion: () => ({ body: generator.generateQuestion() }),
    submitCandidature: (fixtures) => ({ body: generator.generateCandidate({ body_id: fixtures.body.id }) }),
    updateCandidature: () => ({ body: { first_name: 'A new name' } }),
    uploadCandidateImage: image,
    setCandidatureStatus: () => ({ body: { status: 'approved' } }),
    createPlenary: () => ({ body: generator.generatePlenary() }),
    updatePlenary: () => ({ body: { name: 'A new name' } }),
    markPlenaryAttendance: (fixtures) => ({ body: { application_id: fixtures.application.id } })
};

// One of everything a path can name, around a published Agora that is open for
// applications: the caller's own application (accepted and confirmed), the members list
// and the stored limit of the caller's body, an open position with someone's candidature,
// a running plenary and an open question line with the caller's question.
//
// With these, a caller who holds ALL_PERMISSIONS gets 200 on every operation but one:
// submitApplication answers 422, because the caller already applied (asking a question
// needs that application).
exports.createFixtures = async () => {
    const [body] = regularUser.bodies;

    const event = await generator.createEvent({
        type: 'agora',
        application_period_starts: moment().subtract(1, 'week').toDate(),
        application_period_ends: moment().add(1, 'week').toDate(),
        board_approve_deadline: moment().add(2, 'weeks').toDate(),
        participants_list_publish_deadline: moment().add(3, 'weeks').toDate(),
        memberslist_submission_deadline: moment().add(4, 'weeks').toDate(),
        starts: moment().add(3, 'months').toDate(),
        ends: moment().add(3, 'months').add(5, 'days').toDate()
    });
    const application = await generator.createApplication({
        user_id: regularUser.id,
        body_id: body.id,
        status: 'accepted',
        confirmed: true,
        participant_type: 'delegate',
        participant_order: 1
    }, event);
    await generator.createMembersList({ body_id: body.id }, event);
    await generator.createPaxLimit({ body_id: body.id, event_type: 'agora' });

    const position = await generator.createPosition({
        starts: moment().subtract(1, 'week').toDate(),
        ends: moment().add(1, 'week').toDate()
    }, event);
    const candidate = await generator.createCandidate({ body_id: body.id }, position);

    // The statistics export names a sheet after each plenary, and a sheet name is short.
    const plenary = await generator.createPlenary({
        name: 'Opening plenary',
        starts: moment().subtract(1, 'hour').toDate(),
        ends: moment().add(1, 'hour').toDate()
    }, event);

    const questionLine = await generator.createQuestionLine({}, event);
    const question = await generator.createQuestion({ application_id: application.id }, questionLine);

    return {
        event,
        application,
        body,
        // The value of every path parameter in openapi.yaml.
        pathValues: {
            event_id: event.id,
            event_type: 'agora',
            body_id: body.id,
            user_id: regularUser.id,
            application_id: application.id,
            prefix: 'all',
            position_id: position.id,
            candidate_id: candidate.id,
            image: 'image',
            plenary_id: plenary.id,
            question_line_id: questionLine.id,
            question_id: question.id
        }
    };
};

// The path of an operation with the values of the fixtures, some of them replaced.
exports.pathFor = (operation, fixtures, pathValues = {}) => {
    const values = { ...fixtures.pathValues, ...pathValues };
    return operation.template.replace(/\{(\w+)\}/g, (_, name) => encodeURIComponent(values[name]));
};

// What the valid request of an operation sends besides its path.
exports.validRequestOf = (operation, fixtures) => {
    const build = requests[operation.operationId];
    return build ? build(fixtures) : {};
};

// Sends the valid request of an operation, with some path values replaced.
exports.requestFor = (operation, fixtures, { pathValues = {}, headers = { 'X-Auth-Token': 'blablabla' } } = {}) => {
    const values = { ...fixtures.pathValues, ...pathValues };
    const build = requests[operation.operationId];

    return request({
        path: operation.template.replace(/\{(\w+)\}/g, (_, name) => encodeURIComponent(values[name])),
        method: operation.method,
        headers,
        ...(build ? build(fixtures) : {})
    });
};
