import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  EVENT_ACTIONS,
  ROLE_GROUPS,
  actionLabel,
  groupActions,
  visibleActions
} from '../src/views/statutory/eventActions.js'

// The `can` object of the statutory service (getEventPermissions in statutory/lib/helpers.js)
// for a user without any right, before a persona adds its own.
const noRights = () => ({
  edit_event: false,
  use_massmailer: false,
  see_applications: false,
  see_applications_juridical: false,
  see_applications_incoming: false,
  see_applications_network: false,
  see_participants_list: false,
  manage_votings: false,
  manage_candidates: false,
  manage_plenaries: false,
  see_plenaries: false,
  manage_question_lines: false,
  see_questions: false,
  export: { openslides: false, all: false, incoming: false, delegates_jc: false },
  see_boardview: {},
  see_memberslist: {},
  see_missing_memberslist: {},
  see_memberslist_without_fee: {}
})

const hasAnyRight = (rights) => Object.keys(rights).some((key) => rights[key])

// The four users of the issue, as the service computes their rights for an Agora
// two weeks before it starts, with one voting open.
const PERSONAS = {
  // Member of a Local, confirmed delegate, no extra rights.
  delegate: {
    can: { ...noRights(), see_participants_list: true, see_questions: true },
    expected: ['accepted', 'candidates', 'vote', 'questions', 'stats', 'myapplication']
  },
  // Board of a Local: approve_members and manage_memberslist on that Local.
  board: {
    can: {
      ...noRights(),
      see_participants_list: true,
      see_questions: true,
      see_boardview: { global: false, 1: true },
      see_memberslist: { global: false, 1: true }
    },
    expected: [
      'accepted',
      'boardview',
      'memberslist',
      'candidates',
      'vote',
      'questions',
      'stats',
      'myapplication'
    ]
  },
  // The JC of the core seed: manage_juridical, manage_candidates and see_memberslists.
  jc: {
    can: {
      ...noRights(),
      see_applications_juridical: true,
      manage_votings: true,
      manage_candidates: true,
      see_participants_list: true,
      see_questions: true,
      export: { openslides: false, all: false, incoming: false, delegates_jc: true },
      see_memberslist: { global: true }
    },
    expected: [
      'juridical',
      'votings',
      'accepted',
      'memberslist',
      'memberslists',
      'candidates-manage',
      'candidates',
      'vote',
      'questions',
      'stats',
      'myapplication'
    ]
  },
  // Superadmin: every global right. The event is published, so it shows Unpublish.
  admin: {
    can: {
      edit_event: true,
      use_massmailer: true,
      see_applications: true,
      see_applications_juridical: true,
      see_applications_incoming: true,
      see_applications_network: true,
      see_participants_list: true,
      manage_votings: true,
      manage_candidates: true,
      manage_plenaries: true,
      see_plenaries: true,
      manage_question_lines: true,
      see_questions: true,
      export: { openslides: true, all: true, incoming: true, delegates_jc: true },
      see_boardview: { global: true },
      see_memberslist: { global: true },
      see_missing_memberslist: { global: true },
      see_memberslist_without_fee: { global: true }
    },
    expected: [
      'applications',
      'incoming',
      'juridical',
      'votings',
      'network',
      'export',
      'plenaries',
      'accepted',
      'boardview',
      'memberslist',
      'memberslists',
      'memberslists-missing',
      'memberslists-fee',
      'massmailer',
      'candidates-manage',
      'candidates',
      'vote',
      'questions',
      'stats',
      'myapplication',
      'picture',
      'edit',
      'unpublish'
    ]
  }
}

const context = (can, overrides = {}) => ({
  event: { id: 7, url: null, type: 'agora', status: 'published' },
  can,
  canAccessBoardview: hasAnyRight(can.see_boardview),
  canAccessMembersLists: hasAnyRight(can.see_memberslist),
  openVotingsCount: 1,
  ...overrides
})

const ids = (actions) => actions.map((action) => action.id)

describe('visibleActions', () => {
  for (const [name, { can, expected }] of Object.entries(PERSONAS)) {
    it(`shows the ${name} the same ${expected.length} buttons as the page did before`, () => {
      assert.deepEqual(ids(visibleActions(context(can))), expected)
    })
  }

  it('shows Publish instead of Unpublish for a draft event', () => {
    const { can } = PERSONAS.admin
    const draft = ids(visibleActions(context(can, { event: { id: 7, type: 'agora', status: 'draft' } })))

    assert.ok(draft.includes('publish'))
    assert.ok(!draft.includes('unpublish'))
  })

  it('shows no event settings without the right to edit the event', () => {
    const { can } = PERSONAS.admin
    const shown = ids(visibleActions(context({ ...can, edit_event: false })))

    for (const id of ['picture', 'edit', 'unpublish', 'publish']) {
      assert.ok(!shown.includes(id), id)
    }
  })

  it('hides the Agora-only buttons for an EPM', () => {
    const { can } = PERSONAS.admin
    const shown = ids(visibleActions(context(can, { event: { id: 7, type: 'epm', status: 'published' } })))

    for (const id of [
      'votings',
      'candidates',
      'candidates-manage',
      'vote',
      'memberslist',
      'memberslists',
      'memberslists-missing',
      'memberslists-fee'
    ]) {
      assert.ok(!shown.includes(id), id)
    }
    assert.equal(shown.length, 23 - 8)
  })
})

describe('groupActions', () => {
  it('puts every action in exactly one existing group', () => {
    const groupIds = ROLE_GROUPS.map((group) => group.id)

    for (const action of EVENT_ACTIONS) {
      assert.equal(groupIds.filter((id) => id === action.role).length, 1, action.id)
    }
    assert.equal(new Set(ids(EVENT_ACTIONS)).size, EVENT_ACTIONS.length)
  })

  it('has no empty group when the user sees every button', () => {
    const everything = EVENT_ACTIONS
    const groups = groupActions(everything)

    assert.deepEqual(
      groups.map((group) => group.id),
      ROLE_GROUPS.map((group) => group.id)
    )
    assert.equal(groups.flatMap((group) => group.actions).length, everything.length)
  })

  it('drops a group without visible buttons and keeps the order of the page', () => {
    const groups = groupActions(visibleActions(context(PERSONAS.delegate.can)))

    assert.deepEqual(groups.map((group) => group.id), ['participant'])
    assert.deepEqual(ids(groups[0].actions), PERSONAS.delegate.expected)
  })

  it('groups the buttons of the JC by role', () => {
    const groups = groupActions(visibleActions(context(PERSONAS.jc.can)))

    assert.deepEqual(groups.map((group) => group.id), ['participant', 'board', 'jc', 'network'])
    // A global right shows the button under the Local boards (known and accepted).
    assert.deepEqual(ids(groups[1].actions), ['memberslist'])
  })

  it('gives every group a title, an icon and one line of help', () => {
    for (const group of ROLE_GROUPS) {
      assert.ok(group.title && group.icon && group.help, group.id)
    }
  })
})

describe('route actions', () => {
  it('builds the route params with the url of the event, or else its id', () => {
    const vote = EVENT_ACTIONS.find((action) => action.id === 'vote')
    const candidates = EVENT_ACTIONS.find((action) => action.id === 'candidates-manage')

    assert.deepEqual(vote.params(context(noRights())), { id: 7 })
    assert.deepEqual(
      candidates.params(context(noRights(), { event: { id: 7, url: 'agora-x', type: 'agora' } })),
      { id: 'agora-x', prefix: 'all' }
    )
  })

  it('opens a modal or dialog for the buttons without a route', () => {
    const clicks = EVENT_ACTIONS.filter((action) => !action.route).map((action) => [
      action.id,
      action.click
    ])

    assert.deepEqual(clicks, [
      ['picture', { method: 'openPictureModal' }],
      ['unpublish', { method: 'askSwitchStatus', argument: 'draft' }],
      ['publish', { method: 'askSwitchStatus', argument: 'published' }]
    ])
  })
})

describe('actionLabel', () => {
  const vote = EVENT_ACTIONS.find((action) => action.id === 'vote')
  const stats = EVENT_ACTIONS.find((action) => action.id === 'stats')

  it('adds the number of open votings to Vote', () => {
    assert.equal(actionLabel(vote, { openVotingsCount: 2 }), 'Vote (2 open)')
  })

  it('shows plain Vote when no voting is open', () => {
    assert.equal(actionLabel(vote, { openVotingsCount: 0 }), 'Vote')
  })

  it('leaves the label of the other buttons alone', () => {
    assert.equal(actionLabel(stats, { openVotingsCount: 2 }), 'Applications stats')
  })

  it('makes Vote blue only while a voting is open', () => {
    assert.equal(vote.color({ openVotingsCount: 1 }), 'is-primary')
    assert.equal(vote.color({ openVotingsCount: 0 }), null)
  })
})
