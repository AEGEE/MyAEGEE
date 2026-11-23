// Rows of the table-driven sweeps (authentication-required, path-parameters), one per
// authenticated operation of openapi.yaml. See docs/testing/backend-openapi.md.
const { Board, AntennaCriterion, Netcom, MailComponent } = require('../../models');
const generator = require('./generator');
const mock = require('./mock');

// The override if one is given, else the fixture's value.
const or = (override, value) => (override === undefined ? value : override);

// The largest INTEGER: never an existing id.
const NONEXISTENT_ID = 2147483647;

// A body the test user is a member of (core-valid.json) and manages locally.
const BODY_ID = 34;

module.exports = {
    NONEXISTENT_ID,

    // Creates one of everything the paths need and returns it.
    createFixtures: async () => ({
        board: await generator.createBoard({ body_id: BODY_ID, message: 'unchanged' }),
        criterion: await generator.createAntennaCriterion({ agora_id: 1, body_id: BODY_ID, antenna_criterion: 'events', value: 'false' }),
        netcom: await generator.createNetcom({ body_id: BODY_ID, netcom_id: 5 }),
        mailComponent: await generator.createMailComponent({ agora_id: 1, mail_component: 'closing', text: 'unchanged' })
    }),

    // operationId -> concrete path built from the fixtures; `o` overrides one parameter.
    paths: {
        listBoards: () => '/boards',
        listRecentBoardElections: () => '/boards/recents',
        listBodyBoards: (f, o = {}) => `/bodies/${or(o.body_id, BODY_ID)}/boards`,
        createBoard: (f, o = {}) => `/bodies/${or(o.body_id, BODY_ID)}/boards`,
        listCurrentBodyBoards: (f, o = {}) => `/bodies/${or(o.body_id, BODY_ID)}/boards/current`,
        getBoard: (f, o = {}) => `/bodies/${or(o.body_id, BODY_ID)}/boards/${or(o.board_id, f.board.id)}`,
        updateBoard: (f, o = {}) => `/bodies/${or(o.body_id, BODY_ID)}/boards/${or(o.board_id, f.board.id)}`,
        deleteBoard: (f, o = {}) => `/bodies/${or(o.body_id, BODY_ID)}/boards/${or(o.board_id, f.board.id)}`,
        listAntennaCriteria: (f, o = {}) => `/antennaCriteria/${or(o.agora_id, 1)}`,
        setAntennaCriterion: () => '/antennaCriteria',
        sendFulfilmentMail: () => '/antennaCriteria/sendFulfilmentMail',
        listNetcomAssignments: () => '/netcom',
        setNetcomAssignment: () => '/netcom',
        removeNetcomAssignment: (f, o = {}) => `/netcom/${or(o.body_id, BODY_ID)}`,
        listMailComponents: (f, o = {}) => `/mailComponent/${or(o.agora_id, 1)}`,
        setMailComponent: () => '/mailComponent'
    },

    // operationId -> path parameters that the route looks up (404 sweep). An empty list:
    // the 404 has another cause, tested in the route's own file (createBoard: core does
    // not know the body).
    lookups: {
        createBoard: [],
        listCurrentBodyBoards: ['body_id'],
        getBoard: ['body_id', 'board_id'],
        updateBoard: ['body_id', 'board_id'],
        deleteBoard: ['body_id', 'board_id'],
        removeNetcomAssignment: ['body_id']
    },

    // operationId -> the route's own 404 message, so that the sweep cannot pass on the
    // catch-all 404 of a path that is not a route.
    notFoundMessages: {
        listCurrentBodyBoards: 'There is no current board.',
        getBoard: 'The board is not found.',
        updateBoard: 'The board is not found.',
        deleteBoard: 'The board is not found.',
        removeNetcomAssignment: 'NetCom assignment is not found.'
    },

    // operationId -> a body that would succeed with a session (writes only).
    bodies: {
        createBoard: generator.generateBoard({ body_id: BODY_ID, name: 'Created' }),
        updateBoard: { message: 'changed' },
        setAntennaCriterion: { agora_id: 1, body_id: BODY_ID, antenna_criterion: 'events', value: 'true' },
        sendFulfilmentMail: { to: 'board@example.org', subject: 'Antenna Criteria', body: '<p>Text</p>' },
        setNetcomAssignment: { body_id: BODY_ID, netcom_id: 6 },
        setMailComponent: { agora_id: 1, mail_component: 'closing', text: 'changed' }
    },

    // operationId -> async (fixtures) => assertions that the write changed nothing.
    unchanged: {
        createBoard: async () => expect(await Board.count()).toEqual(1),
        updateBoard: async (f) => expect((await Board.findByPk(f.board.id)).message).toEqual('unchanged'),
        deleteBoard: async (f) => expect(await Board.findByPk(f.board.id)).not.toEqual(null),
        setAntennaCriterion: async () => expect((await AntennaCriterion.findOne({ where: { agora_id: 1, body_id: BODY_ID } })).value).toEqual('false'),
        setNetcomAssignment: async () => expect((await Netcom.findByPk(BODY_ID)).netcom_id).toEqual(5),
        removeNetcomAssignment: async () => expect(await Netcom.findByPk(BODY_ID)).not.toEqual(null),
        setMailComponent: async () => expect((await MailComponent.findOne({ where: { agora_id: 1 } })).text).toEqual('unchanged')
    },

    // Core rejects the token.
    asAnonymous: () => mock.mockAll({ core: { unauthorized: true }, mainPermissions: { unauthorized: true } }),
    // Full permissions for the 404 and 400 sweeps.
    asFullPermissions: () => mock.mockAll()
};
