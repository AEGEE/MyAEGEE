/*
  List of all routes for application.
  Is an array of objects with this values:
  - name: component codename (like oms.login)
  - path: the path where this component would be available (can include params, like '/events/:id')
  - component: path to .vue component, located in client/views, without extension
  - meta.auth: if set to false, the user can go to this route unauthorized and the user fetching is skipped, defaults to true
  - meta.skipLazyLoad: if set to true, the item would be imported with 'require', not 'lazyLoading', loading it with all the bundle, defaults to false
  - meta.showSidebar: if set to false, the sidebar would be hidden when this route is active, defaults to true
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
      auth: false,
      showSidebar: false
    }
  },
  {
    name: 'oms.register',
    path: '/signup/:id',
    component: 'auth/Register',
    meta: {
      label: 'Register',
      skipLazyLoad: true,
      auth: false,
      showSidebar: false
    }
  },
  {
    name: 'oms.confirm_token',
    path: '/confirm_signup/',
    component: 'auth/ConfirmToken',
    meta: {
      label: 'Confirm your email',
      skipLazyLoad: true,
      auth: false,
      showSidebar: false
    }
  },
  {
    name: 'oms.password_reset',
    path: '/password_reset/',
    component: 'auth/PasswordReset',
    meta: {
      label: 'Reset your password',
      skipLazyLoad: true,
      auth: false,
      showSidebar: false
    }
  },
  {
    name: 'oms.password_confirm',
    path: '/password_confirm/',
    component: 'auth/PasswordConfirm',
    meta: {
      label: 'Confirm your password',
      skipLazyLoad: true,
      auth: false,
      showSidebar: false
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
  /* Bodies management */
  {
    name: 'oms.bodies.list',
    path: '/bodies',
    component: 'core/bodies/List',
    meta: {
      label: 'View bodies'
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
      label: 'View single body'
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
  {
    name: 'oms.circles.create',
    path: '/circles/new',
    component: 'core/circles/Edit',
    meta: {
      label: 'Create a circle'
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
      label: 'List all events'
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
    path: '/events/:id/apply',
    component: 'events/Apply',
    meta: {
      label: 'Apply to event'
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
    name: 'oms.events.edit_organizers',
    path: '/events/:id/edit_organizers',
    component: 'events/EditOrganizers',
    meta: {
      label: 'Edit organizers of the event'
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
      label: 'Display single event'
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
  /* Static resources. */
  {
    name: 'oms.legal.simple',
    path: '/legal/simple',
    meta: {
      label: 'Privacy policy (simple)',
      auth: false
    },
    component: 'static/LegalSimple'
  },
  {
    name: 'oms.legal.simple',
    path: '/legal/simple',
    meta: {
      label: 'Privacy policy (simple)',
      auth: false
    },
    component: 'static/LegalSimple'
  },
  {
    name: 'oms.legal.full',
    path: '/legal/full',
    meta: {
      label: 'Privacy policy (full)',
      auth: false
    },
    component: 'static/LegalFull'
  },
  {
    name: 'oms.about',
    path: '/about',
    meta: {
      label: 'About OMS',
      auth: false
    },
    component: 'static/About'
  },
  {
    name: 'oms.discounts',
    path: '/discounts',
    meta: {
      label: 'Discounts'
    },
    component: 'static/Discounts'
  },
  {
    name: 'oms.resources',
    path: '/resources',
    meta: {
      label: 'Resources'
    },
    component: 'static/Resources'
  }
]
