/*
  List of all routes for application.
  Is an array of objects with this values:
  - name: component codename (like oms.login)
  - path: the path where this component would be available (can include params, like '/events/:id')
  - component: path to .vue component, located in client/views, without extension
  - meta.auth: if set to false, the user can go to this route unauthorized and the user fetching is skipped, defaults to true
  - meta.skipLazyLoad: if set to true, the item would be imported with 'require', not 'lazyLoading', loading it with all the bundle, defaults to false
  - meta.label: label of the component
*/

module.exports = [
  /* Login and registration. */
  {
    name: 'oms.login',
    path: '/login',
    component: 'auth/Login',
    meta: {
      label: 'Login',
      skipLazyLoad: true,
      auth: false
    }
  },
  {
    name: 'oms.register',
    path: '/signup/:id',
    component: 'auth/Register',
    meta: {
      label: 'Register',
      skipLazyLoad: true,
      auth: false
    }
  },
  {
    name: 'oms.confirm_token',
    path: '/confirm_signup/',
    component: 'auth/ConfirmToken',
    meta: {
      label: 'Confirm your email',
      skipLazyLoad: true,
      auth: false
    }
  },
  {
    name: 'oms.mail_change',
    path: '/mail-change',
    component: 'auth/MailChange',
    meta: {
      label: 'Change your email',
      skipLazyLoad: true,
      auth: false
    }
  },
  {
    name: 'oms.password_reset',
    path: '/password_reset/',
    component: 'auth/PasswordReset',
    meta: {
      label: 'Reset your password',
      skipLazyLoad: true,
      auth: false
    }
  },
  {
    name: 'oms.password_confirm',
    path: '/password_confirm/',
    component: 'auth/PasswordConfirm',
    meta: {
      label: 'Confirm your password',
      skipLazyLoad: true,
      auth: false
    }
  },
  {
    name: 'oms.bug_report',
    path: '/bug_report/',
    component: 'static/BugReport',
    meta: {
      label: 'Report a bug in MyAEGEE',
      auth: false
    }
  },
  {
    name: 'oms.status',
    path: '/status/',
    component: 'static/Status',
    meta: {
      label: 'Status of MyAEGEE services',
      auth: false
    }
  },
  {
    name: 'oms.dashboard',
    path: '/dashboard',
    meta: {
      label: 'Dashboard'
    },
    component: 'dashboard/index'
  },
  {
    name: 'oms.calendar',
    path: '/calendar',
    meta: {
      label: 'Events calendar',
      auth: false
    },
    component: 'dashboard/Calendar'
  },
  /* Members management */
  {
    name: 'oms.members.list',
    path: '/members',
    component: 'core/members/List',
    meta: {
      label: 'View members'
    }
  },
  {
    name: 'oms.members.list.unconfirmed',
    path: '/members/unconfirmed',
    component: 'core/members/ListUnconfirmed',
    meta: {
      label: 'View unconfirmed members'
    }
  },
  {
    name: 'oms.members.edituser',
    path: '/members/edituser',
    component: 'core/members/EditUser',
    meta: {
      label: 'Edit user info'
    }
  },
  {
    name: 'oms.members.edit',
    path: '/members/:id/edit',
    component: 'core/members/Edit',
    meta: {
      label: 'Edit single member'
    }
  },
  {
    name: 'oms.members.view',
    path: '/members/:id',
    component: 'core/members/Single',
    meta: {
      label: 'View single member'
    }
  },
  {
    name: 'oms.profile.update',
    path: '/profile/update',
    component: 'core/members/UpdateProfile',
    meta: {
      label: 'Update your profile'
    }
  },
  /* Bodies management */
  {
    name: 'oms.bodies.list',
    path: '/bodies',
    component: 'core/bodies/List',
    meta: {
      label: 'View bodies',
      auth: false
    }
  },
  {
    name: 'oms.bodies.members',
    path: '/bodies/:id/members',
    component: 'core/bodies/ViewMembers',
    meta: {
      label: 'View members of a body'
    }
  },
  {
    name: 'oms.bodies.campaigns.new',
    path: '/bodies/:body_id/campaigns/new',
    component: 'core/campaigns/Edit',
    meta: {
      label: 'Create campaign for a body'
    }
  },
  {
    name: 'oms.bodies.campaigns.members',
    path: '/bodies/:body_id/campaigns/:id/members',
    component: 'core/campaigns/ViewMembers',
    meta: {
      label: 'View members of a body campaign'
    }
  },
  {
    name: 'oms.bodies.campaigns.edit',
    path: '/bodies/:body_id/campaigns/:id/edit',
    component: 'core/campaigns/Edit',
    meta: {
      label: 'Edit campaign of a body'
    }
  },
  {
    name: 'oms.bodies.campaigns.view',
    path: '/bodies/:body_id/campaigns/:id',
    component: 'core/campaigns/Single',
    meta: {
      label: 'Display campaign of a body'
    }
  },
  {
    name: 'oms.bodies.campaigns',
    path: '/bodies/:id/campaigns',
    component: 'core/bodies/CampaignsList',
    meta: {
      label: 'View members of a body'
    }
  },
  {
    name: 'oms.bodies.join_requests',
    path: '/bodies/:id/join_requests',
    component: 'core/bodies/ViewJoinRequests',
    meta: {
      label: 'View join requests of a body'
    }
  },
  {
    name: 'oms.bodies.new_member',
    path: '/bodies/:id/new_member',
    component: 'core/bodies/CreateMember',
    meta: {
      label: 'Create a member for body'
    }
  },
  {
    name: 'oms.bodies.bulk_import',
    path: '/bodies/:id/bulk_import',
    component: 'core/bodies/BulkImport',
    meta: {
      label: 'Bulk importing members for body'
    }
  },
  {
    name: 'oms.bodies.edit',
    path: '/bodies/:id/edit',
    component: 'core/bodies/Edit',
    meta: {
      label: 'Edit single body'
    }
  },
  {
    name: 'oms.bodies.create',
    path: '/bodies/new',
    component: 'core/bodies/Edit',
    meta: {
      label: 'Create a body'
    }
  },
  {
    name: 'oms.bodies.view',
    path: '/bodies/:id',
    component: 'core/bodies/Single',
    meta: {
      label: 'View single body',
      auth: false
    }
  },
  /* Permissions management */
  {
    name: 'oms.permissions.list',
    path: '/permissions',
    component: 'core/permissions/List',
    meta: {
      label: 'View permissions'
    }
  },
  {
    name: 'oms.permissions.edit',
    path: '/permissions/:id/edit',
    component: 'core/permissions/Edit',
    meta: {
      label: 'Edit single permission'
    }
  },
  {
    name: 'oms.permissions.members',
    path: '/permissions/:id/members',
    component: 'core/permissions/ViewMembers',
    meta: {
      label: 'View members with permission'
    }
  },
  {
    name: 'oms.permissions.create',
    path: '/permissions/new',
    component: 'core/permissions/Edit',
    meta: {
      label: 'Create a permission'
    }
  },
  {
    name: 'oms.permissions.view',
    path: '/permissions/:id',
    component: 'core/permissions/Single',
    meta: {
      label: 'View single permission'
    }
  },
  /* Circles management. */
  {
    name: 'oms.circles.list',
    path: '/circles',
    component: 'core/circles/List',
    meta: {
      label: 'View circles'
    }
  },
  {
    name: 'oms.circles.create',
    path: '/circles/new',
    component: 'core/circles/Edit',
    meta: {
      label: 'Create a circle'
    }
  },
  {
    name: 'oms.circles.view',
    path: '/circles/:id',
    component: 'core/circles/Single',
    meta: {
      label: 'View single circle'
    }
  },
  {
    name: 'oms.circles.members',
    path: '/circles/:id/members',
    component: 'core/circles/ViewMembers',
    meta: {
      label: 'View members of a circle'
    }
  },
  {
    name: 'oms.circles.edit',
    path: '/circles/:id/edit',
    component: 'core/circles/Edit',
    meta: {
      label: 'Edit single circle'
    }
  },
  /* Campaigns management. */
  {
    name: 'oms.campaigns.list',
    path: '/campaigns',
    component: 'core/campaigns/List',
    meta: {
      label: 'View campaigns'
    }
  },
  {
    name: 'oms.campaigns.members',
    path: '/campaigns/:id/members',
    component: 'core/campaigns/ViewMembers',
    meta: {
      label: 'View campaign members'
    }
  },
  {
    name: 'oms.campaigns.edit',
    path: '/campaigns/:id/edit',
    component: 'core/campaigns/Edit',
    meta: {
      label: 'Edit single campaign'
    }
  },
  {
    name: 'oms.campaigns.create',
    path: '/campaigns/new',
    component: 'core/campaigns/Edit',
    meta: {
      label: 'Create a campaign'
    }
  },
  {
    name: 'oms.campaigns.view',
    path: '/campaigns/:id',
    component: 'core/campaigns/Single',
    meta: {
      label: 'View single campaign'
    }
  },
  /* Events management */
  {
    name: 'oms.events.admin',
    path: '/events/serviceadmin',
    component: 'events/ServiceAdmin',
    meta: {
      label: 'Service admin page'
    }
  },
  {
    name: 'oms.events.change_status',
    path: '/events/change_status',
    component: 'events/ChangeStatus',
    meta: {
      label: 'Change events statuses'
    }
  },
  {
    name: 'oms.events.boardview',
    path: '/events/boardview',
    component: 'events/BoardView',
    meta: {
      label: 'Board view'
    }
  },
  {
    name: 'oms.events.list.all',
    path: '/events',
    component: 'events/List',
    meta: {
      label: 'List all events',
      auth: false
    }
  },
  {
    name: 'oms.events.list.participating',
    path: '/events/participating',
    component: 'events/List',
    meta: {
      label: 'List events I\'m participating at'
    }
  },
  {
    name: 'oms.events.list.organizing',
    path: '/events/organizing',
    component: 'events/List',
    meta: {
      label: 'List events I\'m organizing'
    }
  },
  {
    name: 'oms.events.apply',
    path: '/events/:id/applications/:application_id',
    component: 'events/Apply',
    meta: {
      label: 'View/edit the event application'
    }
  },
  {
    name: 'oms.events.participants',
    path: '/events/:id/participants',
    component: 'events/Participants',
    meta: {
      label: 'List/manage participants of the event'
    }
  },
  {
    name: 'oms.events.accepted',
    path: '/events/:id/accepted',
    component: 'events/Accepted',
    meta: {
      label: 'List accepted participants for the event'
    }
  },
  {
    name: 'oms.events.edit',
    path: '/events/:id/edit',
    component: 'events/Edit',
    meta: {
      label: 'Edit single event'
    }
  },
  {
    name: 'oms.events.create',
    path: '/events/new',
    component: 'events/Edit',
    meta: {
      label: 'Create event'
    }
  },
  {
    name: 'oms.events.view',
    path: '/events/:id',
    component: 'events/Single',
    meta: {
      label: 'Display single event',
      auth: false
    }
  },
  /* Summer University management */
  {
    name: 'oms.summeruniversity.list.all',
    path: '/summeruniversity',
    component: 'summeruniversity/List',
    meta: {
      label: 'List all events',
      auth: false
    }
  },
  {
    name: 'oms.summeruniversity.edit',
    path: '/summeruniversity/:id/edit',
    component: 'summeruniversity/Edit',
    meta: {
      label: 'Edit single event'
    }
  },
  {
    name: 'oms.summeruniversity.create',
    path: '/summeruniversity/new',
    component: 'summeruniversity/Edit',
    meta: {
      label: 'Create event'
    }
  },
  {
    name: 'oms.summeruniversity.view',
    path: '/summeruniversity/:id',
    component: 'summeruniversity/Single',
    meta: {
      label: 'Display single event',
      auth: false
    }
  },
  /* Statutory events management. */
  {
    name: 'oms.statutory.list.all',
    path: '/statutory',
    component: 'statutory/List',
    meta: {
      label: 'List all statutory events'
    }
  },
  {
    name: 'oms.statutory.limits',
    path: '/statutory/limits',
    component: 'statutory/PaxLimits',
    meta: {
      label: 'Manage participants limits for Agora'
    }
  },
  {
    name: 'oms.statutory.tasks',
    path: '/statutory/tasks',
    component: 'statutory/TasksList',
    meta: {
      label: 'See background tasks for statutory'
    }
  },
  {
    name: 'oms.statutory.debug',
    path: '/statutory/:id/debug',
    component: 'statutory/Debug',
    meta: {
      label: 'Service page'
    }
  },
  {
    name: 'oms.statutory.applications',
    path: '/statutory/:id/applications',
    component: 'statutory/Applications',
    meta: {
      label: 'Manage participants for the statutory event'
    }
  },
  {
    name: 'oms.statutory.applications.stats',
    path: '/statutory/:id/applications/stats',
    component: 'statutory/Stats',
    meta: {
      label: 'Applications statistics for statutory event'
    }
  },
  {
    name: 'oms.statutory.applications.export',
    path: '/statutory/:id/applications/export',
    component: 'statutory/Export',
    meta: {
      label: 'Export stats for statutory'
    }
  },
  {
    name: 'oms.statutory.applications.new',
    path: '/statutory/:id/applications/new',
    component: 'statutory/EditApplication',
    meta: {
      label: 'Apply for statutory event'
    }
  },
  {
    name: 'oms.statutory.applications.edit',
    path: '/statutory/:id/applications/:application_id/edit',
    component: 'statutory/EditApplication',
    meta: {
      label: 'Manage application for statutory event'
    }
  },
  {
    name: 'oms.statutory.applications.view',
    path: '/statutory/:id/applications/:application_id',
    component: 'statutory/ViewApplication',
    meta: {
      label: 'View application for statutory event'
    }
  },
  {
    name: 'oms.statutory.accepted',
    path: '/statutory/:id/accepted',
    component: 'statutory/Accepted',
    meta: {
      label: 'List accepted participants for the statutory event'
    }
  },
  {
    name: 'oms.statutory.incoming',
    path: '/statutory/:id/incoming',
    component: 'statutory/Incoming',
    meta: {
      label: 'Manage incoming info for the statutory event'
    }
  },
  {
    name: 'oms.statutory.juridical',
    path: '/statutory/:id/juridical',
    component: 'statutory/Juridical',
    meta: {
      label: 'Manage juridical info for the statutory event'
    }
  },
  {
    name: 'oms.statutory.network',
    path: '/statutory/:id/network',
    component: 'statutory/NetworkListing',
    meta: {
      label: 'Set members list status for participants'
    }
  },
  {
    name: 'oms.statutory.boardview',
    path: '/statutory/:id/boardview',
    component: 'statutory/BoardView',
    meta: {
      label: 'Board view for statutory events.'
    }
  },
  {
    name: 'oms.statutory.memberslist.upload',
    path: '/statutory/:id/memberslist/upload',
    component: 'statutory/UploadMembersList',
    meta: {
      label: 'Upload members list'
    }
  },
  {
    name: 'oms.statutory.memberslist.list',
    path: '/statutory/:id/memberslist/list',
    component: 'statutory/ListMembersLists',
    meta: {
      label: 'List members lists'
    }
  },
  {
    name: 'oms.statutory.massmailer',
    path: '/statutory/:id/massmailer',
    component: 'statutory/MassMailer',
    meta: {
      label: 'Massmailer for statutory events'
    }
  },
  {
    name: 'oms.statutory.edit',
    path: '/statutory/:id/edit',
    component: 'statutory/Edit',
    meta: {
      label: 'Edit single event'
    }
  },
  {
    name: 'oms.statutory.create',
    path: '/statutory/new',
    component: 'statutory/Edit',
    meta: {
      label: 'Create event'
    }
  },
  {
    name: 'oms.statutory.view',
    path: '/statutory/:id',
    component: 'statutory/Single',
    meta: {
      label: 'Display single event'
    }
  },
  {
    name: 'oms.statutory.votes',
    path: '/statutory/:id/votes',
    component: 'statutory/VotesAmounts',
    meta: {
      label: 'Votes amount per antenna/delegates'
    }
  },
  {
    name: 'oms.statutory.candidates.export',
    path: '/statutory/:id/positions/export',
    component: 'statutory/ExportCandidates',
    meta: {
      label: 'Export candidates for statutory event'
    }
  },
  {
    name: 'oms.statutory.positions',
    path: '/statutory/:id/positions/:prefix',
    component: 'statutory/PositionsList',
    meta: {
      label: 'Positions list for Agora'
    }
  },
  {
    name: 'oms.statutory.candidates.new',
    path: '/statutory/:id/positions/:position_id/apply',
    component: 'statutory/EditCandidate',
    meta: {
      label: 'Apply as a candidate'
    }
  },
  {
    name: 'oms.statutory.candidates.edit',
    path: '/statutory/:id/positions/:position_id/candidates/:candidate_id/edit',
    component: 'statutory/EditCandidate',
    meta: {
      label: 'Edit your application'
    }
  },
  {
    name: 'oms.statutory.question_lines',
    path: '/statutory/:id/question-lines/',
    component: 'statutory/QuestionLinesList',
    meta: {
      label: 'Question lines list for Agora'
    }
  },
  {
    name: 'oms.statutory.plenaries',
    path: '/statutory/:id/plenaries/',
    component: 'statutory/PlenariesList',
    meta: {
      label: 'Plenaries list for Agora'
    }
  },
  {
    name: 'oms.statutory.plenaries.view',
    path: '/statutory/:id/plenaries/:plenary_id',
    component: 'statutory/ViewPlenary',
    meta: {
      label: 'Plenary details and marking attendance'
    }
  },
  /* Static resources. */
  {
    name: 'oms.about',
    path: '/about',
    meta: {
      label: 'About MyAEGEE',
      auth: false
    },
    component: 'static/About'
  },
  {
    name: 'oms.resources',
    path: '/resources',
    meta: {
      label: 'Resources'
    },
    component: 'static/Resources'
  },
  /* Discounts distribution */
  {
    name: 'oms.discounts',
    path: '/discounts',
    meta: {
      label: 'Discounts'
    },
    component: 'discounts/DiscountsList'
  },
  {
    name: 'oms.discounts.categories.edit',
    path: '/discounts/categories/:id/edit',
    component: 'discounts/CategoryEdit',
    meta: {
      label: 'Edit single category'
    }
  },
  {
    name: 'oms.discounts.categories.list',
    path: '/discounts/categories/',
    component: 'discounts/CategoriesList',
    meta: {
      label: 'List a category of discounts'
    }
  },
  {
    name: 'oms.discounts.categories.create',
    path: '/discounts/categories/new',
    component: 'discounts/CategoryEdit',
    meta: {
      label: 'Create a category of discounts'
    }
  },
  {
    name: 'oms.discounts.list',
    path: '/discounts/integrations',
    component: 'discounts/List',
    meta: {
      label: 'View discount integrations'
    }
  },
  {
    name: 'oms.discounts.my_discounts',
    path: '/discounts/my',
    component: 'discounts/MyDiscounts',
    meta: {
      label: 'My discounts'
    }
  },
  {
    name: 'oms.discounts.add_codes',
    path: '/discounts/integrations/:id/add-codes',
    component: 'discounts/AddCodes',
    meta: {
      label: 'Add codes to integration'
    }
  },
  {
    name: 'oms.discounts.edit',
    path: '/discounts/integrations/:id/edit',
    component: 'discounts/Edit',
    meta: {
      label: 'Edit single integration'
    }
  },
  {
    name: 'oms.discounts.create',
    path: '/discounts/integrations/new',
    component: 'discounts/Edit',
    meta: {
      label: 'Create a integration'
    }
  },
  {
    name: 'oms.confluence',
    path: '/pages/:page_id',
    component: 'static/ConfluencePage',
    meta: {
      label: 'Display page',
      auth: false
    }
  }
]
