/* eslint-env jest */

import flushPromises from 'flush-promises'

import EventApply from 'src/views/events/Apply.vue'
import EventAccepted from 'src/views/events/Accepted.vue'
import EventEdit from 'src/views/events/Edit.vue'
import EventParticipants from 'src/views/events/Participants.vue'
import SummerUniversityApply from 'src/views/summeruniversity/Apply.vue'
import SummerUniversityEdit from 'src/views/summeruniversity/Edit.vue'
import SummerUniversityEditSecond from 'src/views/summeruniversity/EditSecond.vue'
import SummerUniversityList from 'src/views/summeruniversity/List.vue'
import SummerUniversityParticipants from 'src/views/summeruniversity/Participants.vue'
import StatutoryEdit from 'src/views/statutory/Edit.vue'
import StatutoryBoardView from 'src/views/statutory/BoardView.vue'
import UploadMembersList from 'src/views/statutory/UploadMembersList.vue'
import ViewPlenary from 'src/views/statutory/ViewPlenary.vue'
import ViewApplication from 'src/views/statutory/ViewApplication.vue'
import { createRejectedAxiosError, mountFrontendView } from '../test-utils'

const createStubComponent = (name) => ({ name, render: (h) => h('div') })

jest.mock('vue-mapbox', () => ({
  MglMap: createStubComponent('MglMap'),
  MglMarker: createStubComponent('MglMarker'),
  MglNavigationControl: createStubComponent('MglNavigationControl'),
  MglFullscreenControl: createStubComponent('MglFullscreenControl'),
  MglGeolocateControl: createStubComponent('MglGeolocateControl'),
  MglAttributionControl: createStubComponent('MglAttributionControl'),
  MglScaleControl: createStubComponent('MglScaleControl'),
  MglGeojsonLayer: createStubComponent('MglGeojsonLayer')
}))

describe('frontend route regressions', () => {
  test('events apply redirects missing events to the published events list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject(createRejectedAxiosError('Not found', { status: 404 })))
    }

    const { showError } = mountFrontendView(EventApply, {
      axios,
      router,
      route: { params: { id: 'missing', application_id: 'me' } },
      services: { events: '/api/events' },
      user: { bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.list.all' })
  })

  test('summer university apply redirects missing events to the published SU list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject(createRejectedAxiosError('Not found', { status: 404 })))
    }

    const { showError } = mountFrontendView(SummerUniversityApply, {
      axios,
      router,
      route: { params: { id: 'missing', application_id: 'me' } },
      services: { summeruniversity: '/api/summeruniversity' },
      user: { bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.summeruniversity.list.all' })
  })

  test('events apply surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(EventApply, {
      axios,
      router,
      route: { params: { id: 'missing', application_id: 'me' } },
      services: { events: '/api/events' },
      user: { bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.list.all' })
  })

  test('summer university apply surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(SummerUniversityApply, {
      axios,
      router,
      route: { params: { id: 'missing', application_id: 'me' } },
      services: { summeruniversity: '/api/summeruniversity' },
      user: { bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.summeruniversity.list.all' })
  })

  test('statutory members list redirects to the statutory view route when event fetch fails', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject(createRejectedAxiosError('Not found', { status: 404 })))
    }

    const { showError } = mountFrontendView(UploadMembersList, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory', core: '/api/core' }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.view', params: { id: '17' } })
  })

  test('statutory members list surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(UploadMembersList, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory', core: '/api/core' }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.view', params: { id: '17' } })
  })

  test('statutory board view clears loading state after event fetch succeeds', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn((url) => {
        if (url === '/api/statutory/events/17') {
          return Promise.resolve({
            data: {
              data: {
                id: 17,
                type: 'agora',
                questions: [],
                permissions: {
                  see_boardview: {},
                  set_board_comment_and_participant_type: { global: false }
                }
              }
            }
          })
        }

        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })
    }

    const { wrapper, showError } = mountFrontendView(StatutoryBoardView, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory', core: '/api/core' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(wrapper.vm.isLoading).toEqual(false)
  })

  test('events edit redirects missing events to the published events list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject(createRejectedAxiosError('Not found', { status: 404 })))
    }

    const { showError } = mountFrontendView(EventEdit, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { events: '/api/events', core: '/api/core' },
      user: { id: 1, first_name: 'Ada', last_name: 'Tester', bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.list.all' })
  })

  test('events edit surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(EventEdit, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { events: '/api/events', core: '/api/core' },
      user: { id: 1, first_name: 'Ada', last_name: 'Tester', bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.list.all' })
  })

  test('events accepted redirects missing events to the published events list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject(createRejectedAxiosError('Not found', { status: 404 })))
    }

    const { showError } = mountFrontendView(EventAccepted, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { events: '/api/events' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.list.all' })
  })

  test('events accepted surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(EventAccepted, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { events: '/api/events' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.list.all' })
  })

  test('events participants redirects missing events to the published events list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject(createRejectedAxiosError('Not found', { status: 404 })))
    }

    const { showError } = mountFrontendView(EventParticipants, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { events: '/api/events' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.list.all' })
  })

  test('events participants surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(EventParticipants, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { events: '/api/events' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.list.all' })
  })

  test('summer university edit redirects missing events to the published SU list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject(createRejectedAxiosError('Not found', { status: 404 })))
    }

    const { showError } = mountFrontendView(SummerUniversityEdit, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { summeruniversity: '/api/summeruniversity', core: '/api/core' },
      user: { id: 1, first_name: 'Ada', last_name: 'Tester', bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.summeruniversity.list.all' })
  })

  test('summer university edit surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(SummerUniversityEdit, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { summeruniversity: '/api/summeruniversity', core: '/api/core' },
      user: { id: 1, first_name: 'Ada', last_name: 'Tester', bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.summeruniversity.list.all' })
  })

  test('summer university second edit redirects missing events to the published SU list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject(createRejectedAxiosError('Not found', { status: 404 })))
    }

    const { showError } = mountFrontendView(SummerUniversityEditSecond, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { summeruniversity: '/api/summeruniversity', core: '/api/core' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.summeruniversity.list.all' })
  })

  test('summer university second edit surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(SummerUniversityEditSecond, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { summeruniversity: '/api/summeruniversity', core: '/api/core' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.summeruniversity.list.all' })
  })

  test('summer university participants redirects missing events to the published SU list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject(createRejectedAxiosError('Not found', { status: 404 })))
    }

    const { showError } = mountFrontendView(SummerUniversityParticipants, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { summeruniversity: '/api/summeruniversity' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.summeruniversity.list.all' })
  })

  test('summer university participants surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(SummerUniversityParticipants, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { summeruniversity: '/api/summeruniversity' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.summeruniversity.list.all' })
  })

  test('summer university list enables apply action when apply permission is returned', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn((url) => {
        if (url === '/api/summeruniversity') {
          return Promise.resolve({
            data: {
              data: [{
                id: 17,
                name: 'Summer University Test',
                url: 'su-test',
                description: 'Description',
                type: 'regular',
                starts: '2026-07-01T10:00:00.000Z',
                ends: '2026-07-10T10:00:00.000Z',
                application_status: 'open',
                open_call: false,
                application_ends: '2026-06-01T10:00:00.000Z',
                organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Test' }]
              }]
            }
          })
        }

        if (url === '/api/core/my_permissions') {
          return Promise.resolve({
            data: {
              data: [{ combined: 'global:apply:summeruniversity' }]
            }
          })
        }

        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      }),
      CancelToken: {
        source: () => ({ token: 'cancel-token', cancel: jest.fn() })
      },
      isCancel: jest.fn(() => false)
    }

    const { wrapper } = mountFrontendView(SummerUniversityList, {
      axios,
      router,
      route: { name: 'oms.summeruniversity.list.all', params: {} },
      services: { summeruniversity: '/api/summeruniversity', core: '/api/core', 'summeruniversity-static': '/static/su' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(wrapper.vm.can.apply).toEqual(true)
  })

  test('events edit keeps starts and ends as separate loaded dates', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn((url) => {
        if (url === '/api/core/bodies/') return Promise.resolve({ data: { data: [{ id: 1, name: 'AEGEE-Test' }] } })
        if (url === '/api/core/my_permissions/') return Promise.resolve({ data: { data: [] } })
        if (url === '/api/events/single/17') {
          return Promise.resolve({
            data: {
              data: {
                starts: '2026-04-01T10:00:00.000Z',
                ends: '2026-04-05T15:00:00.000Z',
                application_starts: '2026-03-01T09:00:00.000Z',
                application_ends: '2026-03-20T09:00:00.000Z',
                questions: [],
                locations: [],
                organizing_bodies: [{ body_id: 1 }],
                organizers: [{ user_id: 1 }]
              },
              permissions: {}
            }
          })
        }

        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })
    }

    const { wrapper } = mountFrontendView(EventEdit, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { events: '/api/events', core: '/api/core' },
      user: { id: 1, first_name: 'Ada', last_name: 'Tester', bodies: [] }
    })

    await flushPromises()

    expect(wrapper.vm.event.starts.toISOString()).toEqual('2026-04-01T10:00:00.000Z')
    expect(wrapper.vm.event.ends.toISOString()).toEqual('2026-04-05T15:00:00.000Z')
    expect(wrapper.vm.dates.starts.toISOString()).toEqual('2026-04-01T10:00:00.000Z')
    expect(wrapper.vm.dates.ends.toISOString()).toEqual('2026-04-05T15:00:00.000Z')
  })

  test('summer university edit keeps starts and ends as separate loaded dates', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn((url) => {
        if (url === '/api/core/bodies/') return Promise.resolve({ data: { data: [{ id: 1, name: 'AEGEE-Test' }] } })
        if (url === '/api/core/my_permissions/') return Promise.resolve({ data: { data: [] } })
        if (url === '/api/summeruniversity/single/17') {
          return Promise.resolve({
            data: {
              data: {
                starts: '2026-07-01T10:00:00.000Z',
                ends: '2026-07-12T18:00:00.000Z',
                learning_objectives: [],
                social_media: [],
                photos: [],
                questions: [],
                locations: [],
                organizing_bodies: [{ body_id: 1 }],
                cooperation: [],
                organizers: [{ user_id: 1 }]
              },
              permissions: {}
            }
          })
        }
        if (url === '/api/core/members/1') {
          return Promise.resolve({ data: { data: { first_name: 'Ada', last_name: 'Tester' } } })
        }

        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })
    }

    const { wrapper } = mountFrontendView(SummerUniversityEdit, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { summeruniversity: '/api/summeruniversity', core: '/api/core' },
      user: { id: 1, first_name: 'Ada', last_name: 'Tester', bodies: [] }
    })

    await flushPromises()

    expect(wrapper.vm.event.starts.toISOString()).toEqual('2026-07-01T10:00:00.000Z')
    expect(wrapper.vm.event.ends.toISOString()).toEqual('2026-07-12T18:00:00.000Z')
    expect(wrapper.vm.dates.starts.toISOString()).toEqual('2026-07-01T10:00:00.000Z')
    expect(wrapper.vm.dates.ends.toISOString()).toEqual('2026-07-12T18:00:00.000Z')
  })

  test('statutory edit keeps starts and ends as separate loaded dates', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn((url) => {
        if (url === '/api/statutory/events/17') {
          return Promise.resolve({
            data: {
              data: {
                starts: '2026-10-01T10:00:00.000Z',
                ends: '2026-10-05T14:00:00.000Z',
                application_period_starts: '2026-08-01T00:00:00.000Z',
                application_period_ends: '2026-08-20T00:00:00.000Z',
                board_approve_deadline: '2026-08-25T00:00:00.000Z',
                participants_list_publish_deadline: '2026-09-01T00:00:00.000Z',
                memberslist_submission_deadline: '2026-09-05T00:00:00.000Z',
                draft_proposal_deadline: '2026-09-10T00:00:00.000Z',
                final_proposal_deadline: '2026-09-15T00:00:00.000Z',
                candidature_deadline: '2026-09-20T00:00:00.000Z',
                booklet_publication_deadline: '2026-09-22T00:00:00.000Z',
                updated_booklet_publication_deadline: '2026-09-25T00:00:00.000Z',
                questions: [],
                locations: [],
                body_id: 1,
                permissions: {}
              }
            }
          })
        }
        if (url === '/api/core/bodies/1') {
          return Promise.resolve({ data: { data: { id: 1, name: 'AEGEE-Test' } } })
        }

        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })
    }

    const { wrapper } = mountFrontendView(StatutoryEdit, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory', core: '/api/core' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(wrapper.vm.event.starts.toISOString()).toEqual('2026-10-01T10:00:00.000Z')
    expect(wrapper.vm.event.ends.toISOString()).toEqual('2026-10-05T14:00:00.000Z')
    expect(wrapper.vm.dates.starts.toISOString()).toEqual('2026-10-01T10:00:00.000Z')
    expect(wrapper.vm.dates.ends.toISOString()).toEqual('2026-10-05T14:00:00.000Z')
  })

  test('statutory edit surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(StatutoryEdit, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory', core: '/api/core' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.list.all' })
  })

  test('statutory view plenary surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(ViewPlenary, {
      axios,
      router,
      route: { params: { id: '17', plenary_id: '2' } },
      services: { statutory: '/api/statutory' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.list.all' })
  })

  test('statutory view application surfaces generic network failures without crashing', async () => {
    const router = { push: jest.fn() }
    const failure = new Error('network failed')
    const axios = {
      get: jest.fn(() => Promise.reject(failure))
    }

    const { showError } = mountFrontendView(ViewApplication, {
      axios,
      router,
      route: { params: { id: '17', application_id: '2' } },
      services: { statutory: '/api/statutory' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.list.all' })
  })
})
