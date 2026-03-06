export const services = {
  core: '/api/core',
  discounts: '/api/discounts'
}

export const managerPermissions = [
  {
    combined: 'global:manage:discounts'
  }
]

export const unrelatedPermissions = [
  {
    combined: 'global:manage:events'
  }
]

export const categoriesResponse = [
  {
    name: 'Travel',
    discounts: [
      {
        name: 'FlixBus',
        icon: 'bus',
        shortDescription: 'Travel cheaper',
        longDescription: 'Long description'
      }
    ]
  }
]

export const claimedCodesResponse = [
  {
    id: 1,
    value: 'ALREADY-CLAIMED',
    updated_at: '2026-03-06T12:00:00.000Z',
    integration: {
      id: 7,
      name: 'FlixBus',
      description: 'Existing description'
    }
  }
]

export const integrationsResponse = [
  {
    id: 7,
    name: 'FlixBus',
    description: 'Existing description'
  },
  {
    id: 8,
    name: 'Rail Europe',
    description: 'Rail description'
  }
]

export const claimResponse = {
  id: 2,
  value: 'NEW-CODE',
  updated_at: '2026-03-07T12:00:00.000Z'
}
