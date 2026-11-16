// The buttons in the side column of the statutory event page, as one list.
// Each action says who sees it (`visible`, the rule the page always used), what it does and
// to which role group it belongs. The page only renders this list.
//
// `ctx` is { event, can, canAccessBoardview, canAccessMembersLists, openVotingsCount }:
// `can` holds the permissions of the statutory service (getEventPermissions in
// statutory/lib/helpers.js), which decide everything. Nothing here grants a right.

const eventId = ({ event }) => event.url || event.id
const isAgora = ({ event }) => event.type === 'agora'

const eventParams = (ctx) => ({ id: eventId(ctx) })

export const ROLE_GROUPS = [
  {
    id: 'participant',
    title: 'Your participation',
    icon: 'user',
    help: 'Your application, and what you need as a participant: candidates, questions and votes.'
  },
  {
    id: 'board',
    title: 'Local boards',
    icon: 'users',
    help: 'Approve the applications from a Local and send its members list.'
  },
  {
    id: 'organisers',
    title: 'Organisers and incoming team',
    icon: 'clipboard-list',
    help: 'Applications, arrival and emails to the participants.'
  },
  {
    id: 'jc',
    title: 'JC and chair team',
    icon: 'university',
    help: 'Check-in, plenaries, votings and candidatures of the Agora.'
  },
  {
    id: 'network',
    title: 'Network and finances',
    icon: 'globe-europe',
    help: 'Members lists of all Locals and their membership fee.'
  },
  {
    id: 'settings',
    title: 'Event settings',
    icon: 'wrench',
    help: 'Image, details and visibility of this event.'
  }
]

// In the order of the page. A route action has `route` and `params`;
// any other action has `click`, the method of the page that it calls.
export const EVENT_ACTIONS = [
  {
    id: 'applications',
    label: 'View applications',
    icon: 'users',
    route: 'oms.statutory.applications',
    params: eventParams,
    visible: ({ can }) => can.see_applications,
    role: 'organisers'
  },
  {
    id: 'incoming',
    label: 'Manage incoming info',
    icon: 'users',
    route: 'oms.statutory.incoming',
    params: eventParams,
    visible: ({ can }) => can.see_applications_incoming,
    role: 'organisers'
  },
  {
    id: 'juridical',
    label: 'Manage juridical info',
    icon: 'users',
    route: 'oms.statutory.juridical',
    params: eventParams,
    visible: ({ can }) => can.see_applications_juridical,
    role: 'jc'
  },
  {
    id: 'votings',
    label: 'Manage votings',
    icon: 'vote-yea',
    route: 'oms.statutory.votings',
    params: eventParams,
    visible: (ctx) => ctx.can.manage_votings && isAgora(ctx),
    role: 'jc'
  },
  {
    id: 'network',
    label: 'Manage members list status',
    icon: 'users',
    route: 'oms.statutory.network',
    params: eventParams,
    visible: ({ can }) => can.see_applications_network,
    role: 'network'
  },
  {
    id: 'export',
    label: 'Export participants info',
    icon: 'users',
    route: 'oms.statutory.applications.export',
    params: eventParams,
    visible: ({ can }) => can.export.all || can.export.incoming || can.export.openslides,
    role: 'organisers'
  },
  {
    id: 'plenaries',
    label: 'Manage/view plenaries',
    icon: 'check',
    route: 'oms.statutory.plenaries',
    params: eventParams,
    visible: ({ can }) => can.see_plenaries || can.manage_plenaries,
    role: 'jc'
  },
  {
    id: 'accepted',
    label: 'Participants list',
    icon: 'users',
    route: 'oms.statutory.accepted',
    params: eventParams,
    visible: ({ can }) => can.see_participants_list,
    role: 'participant'
  },
  {
    id: 'boardview',
    label: 'Board view',
    icon: 'users',
    route: 'oms.statutory.boardview',
    params: eventParams,
    visible: ({ canAccessBoardview }) => canAccessBoardview,
    role: 'board'
  },
  {
    // Also visible through a global right (the JC, the Network): it stays under the Local boards.
    id: 'memberslist',
    label: 'Manage members list',
    icon: 'users',
    route: 'oms.statutory.memberslist.upload',
    params: eventParams,
    visible: (ctx) => ctx.canAccessMembersLists && isAgora(ctx),
    role: 'board'
  },
  {
    id: 'memberslists',
    label: 'See members lists',
    icon: 'users',
    route: 'oms.statutory.memberslist.list',
    params: eventParams,
    visible: (ctx) => ctx.can.see_memberslist.global && isAgora(ctx),
    role: 'network'
  },
  {
    id: 'memberslists-missing',
    label: 'See missing members lists',
    icon: 'users',
    route: 'oms.statutory.memberslist.list.missing',
    params: eventParams,
    visible: (ctx) => ctx.can.see_missing_memberslist.global && isAgora(ctx),
    role: 'network'
  },
  {
    id: 'memberslists-fee',
    label: 'See members lists without fee',
    icon: 'users',
    route: 'oms.statutory.memberslist.list.without_fee',
    params: eventParams,
    visible: (ctx) => ctx.can.see_memberslist_without_fee.global && isAgora(ctx),
    role: 'network'
  },
  {
    id: 'massmailer',
    label: 'Mass mailer',
    icon: 'envelope',
    route: 'oms.statutory.massmailer',
    params: eventParams,
    visible: ({ can }) => can.use_massmailer,
    role: 'organisers'
  },
  {
    id: 'candidates-manage',
    label: 'Manage candidates',
    icon: 'vote-yea',
    route: 'oms.statutory.positions',
    params: (ctx) => ({ id: eventId(ctx), prefix: 'all' }),
    visible: (ctx) => ctx.can.manage_candidates && isAgora(ctx),
    role: 'jc'
  },
  {
    id: 'candidates',
    label: 'View candidates',
    icon: 'vote-yea',
    route: 'oms.statutory.positions',
    params: (ctx) => ({ id: eventId(ctx), prefix: 'approved' }),
    visible: isAgora,
    role: 'participant'
  },
  {
    id: 'vote',
    label: 'Vote',
    icon: 'vote-yea',
    route: 'oms.statutory.vote',
    params: eventParams,
    visible: isAgora,
    color: ({ openVotingsCount }) => (openVotingsCount > 0 ? 'is-primary' : null),
    role: 'participant'
  },
  {
    id: 'questions',
    label: 'Question lines',
    icon: 'question',
    route: 'oms.statutory.question_lines',
    params: eventParams,
    visible: ({ can }) => can.see_questions || can.manage_question_lines,
    role: 'participant'
  },
  {
    id: 'stats',
    label: 'Applications stats',
    icon: 'table',
    route: 'oms.statutory.applications.stats',
    params: eventParams,
    visible: () => true,
    role: 'participant'
  },
  {
    id: 'myapplication',
    label: 'My application',
    icon: 'plus',
    route: 'oms.statutory.applications.view',
    params: (ctx) => ({ id: eventId(ctx), application_id: 'me' }),
    visible: () => true,
    color: () => 'is-warning',
    role: 'participant'
  },
  {
    id: 'picture',
    label: 'Change picture',
    icon: 'camera',
    click: { method: 'openPictureModal' },
    visible: ({ can }) => can.edit_event,
    color: () => 'is-primary',
    role: 'settings'
  },
  {
    id: 'edit',
    label: 'Edit event',
    icon: 'edit',
    route: 'oms.statutory.edit',
    params: eventParams,
    visible: ({ can }) => can.edit_event,
    color: () => 'is-warning',
    role: 'settings'
  },
  {
    id: 'unpublish',
    label: 'Unpublish',
    icon: 'pen',
    click: { method: 'askSwitchStatus', argument: 'draft' },
    visible: ({ can, event }) => can.edit_event && event.status === 'published',
    color: () => 'is-danger',
    role: 'settings'
  },
  {
    id: 'publish',
    label: 'Publish',
    icon: 'globe',
    click: { method: 'askSwitchStatus', argument: 'published' },
    visible: ({ can, event }) => can.edit_event && event.status === 'draft',
    color: () => 'is-info',
    role: 'settings'
  }
]

export const visibleActions = (ctx) => EVENT_ACTIONS.filter((action) => action.visible(ctx))

// The role groups that have at least one of the actions, in the order of ROLE_GROUPS.
export const groupActions = (actions) => {
  const groups = ROLE_GROUPS.map((group) => ({
    ...group,
    actions: actions.filter((action) => action.role === group.id)
  }))

  return groups.filter((group) => group.actions.length > 0)
}

export const actionLabel = (action, ctx) => {
  if (action.id === 'vote' && ctx.openVotingsCount > 0) {
    return `Vote (${ctx.openVotingsCount} open)`
  }

  return action.label
}
