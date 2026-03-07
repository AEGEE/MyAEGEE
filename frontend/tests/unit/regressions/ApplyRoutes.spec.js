/* eslint-env jest */

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

import flushPromises from 'flush-promises'

import Vuex from 'vuex'
import { createLocalVue, shallowMount } from '@vue/test-utils'
import filters from 'src/filters'

import EventApply from 'src/views/events/Apply.vue'
import EventAccepted from 'src/views/events/Accepted.vue'
import EventEdit from 'src/views/events/Edit.vue'
import EventParticipants from 'src/views/events/Participants.vue'
import SummerUniversityApply from 'src/views/summeruniversity/Apply.vue'
import SummerUniversityEdit from 'src/views/summeruniversity/Edit.vue'
import SummerUniversityEditSecond from 'src/views/summeruniversity/EditSecond.vue'
import SummerUniversityParticipants from 'src/views/summeruniversity/Participants.vue'
import StatutoryEdit from 'src/views/statutory/Edit.vue'
import UploadMembersList from 'src/views/statutory/UploadMembersList.vue'

function mountView (component, { services, route, user = { bodies: [] }, axios, router }) {
  const localVue = createLocalVue()
  localVue.use(Vuex)
  Object.keys(filters).forEach((key) => {
    localVue.filter(key, filters[key])
  })

  const store = new Vuex.Store({
    state: {
      services,
      user
    },
    getters: {
      services: (state) => state.services,
      user: (state) => state.user
    }
  })

  const showError = jest.fn()
  const showSuccess = jest.fn()

  const wrapper = shallowMount(component, {
    localVue,
    store,
    mocks: {
      axios,
      $route: route,
      $router: router,
      $buefy: { dialog: { confirm: jest.fn() } },
      accessToken: 'test-token',
      $root: {
        showError,
        showSuccess,
        sluggify: jest.fn((value) => value)
      }
    },
    parentComponent: {
      methods: {
        showError,
        showSuccess
      }
    },
    stubs: {
      'router-link': true,
      'event-no-body-notification': true,
      'font-awesome-icon': true,
      'b-loading': true,
      'b-checkbox': true,
      'multiselect': true,
      'draggable': true,
      'mgl-map': true,
      'mgl-marker': true,
      'mgl-geolocate-control': true,
      'mgl-navigation-control': true,
      'mgl-fullscreen-control': true,
      'mgl-attribution-control': true,
      'mgl-scale-control': true,
      'mgl-geojson-layer': true,
      'b-field': true,
      'b-input': true,
      'b-select': true,
      'b-datepicker': true,
      'b-timepicker': true,
      'b-upload': true,
      'b-switch': true,
      'b-numberinput': true,
      'b-collapse': true,
      'b-button': true,
      'b-table': true,
      'b-table-column': true,
      'b-icon': true,
      'b-tooltip': true,
      'b-message': true,
      'b-radio': true,
      'b-tag': true,
      'b-taginput': true,
      'b-autocomplete': true,
      'b-tabs': true,
      'b-tab-item': true,
      'b-notification': true,
      'b-dropdown': true,
      'b-dropdown-item': true,
      'v-jsoneditor': true,
      'empty-table': true,
      'flat-pickr': true
    }
  })

  return { wrapper, showError }
}

describe('frontend route regressions', () => {
  test('events apply redirects missing events to the published events list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject({ response: { status: 404 } }))
    }

    const { showError } = mountView(EventApply, {
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
      get: jest.fn(() => Promise.reject({ response: { status: 404 } }))
    }

    const { showError } = mountView(SummerUniversityApply, {
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

  test('statutory members list redirects to the statutory view route when event fetch fails', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject({ response: { status: 404 } }))
    }

    const { showError } = mountView(UploadMembersList, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory', core: '/api/core' }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Event is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.view', params: { id: '17' } })
  })

  test('events edit redirects missing events to the published events list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject({ response: { status: 404 } }))
    }

    const { showError } = mountView(EventEdit, {
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

  test('events accepted redirects missing events to the published events list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject({ response: { status: 404 } }))
    }

    const { showError } = mountView(EventAccepted, {
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

  test('events participants redirects missing events to the published events list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject({ response: { status: 404 } }))
    }

    const { showError } = mountView(EventParticipants, {
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

  test('summer university edit redirects missing events to the published SU list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject({ response: { status: 404 } }))
    }

    const { showError } = mountView(SummerUniversityEdit, {
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

  test('summer university second edit redirects missing events to the published SU list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject({ response: { status: 404 } }))
    }

    const { showError } = mountView(SummerUniversityEditSecond, {
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

  test('summer university participants redirects missing events to the published SU list route', async () => {
    const router = { push: jest.fn() }
    const axios = {
      get: jest.fn(() => Promise.reject({ response: { status: 404 } }))
    }

    const { showError } = mountView(SummerUniversityParticipants, {
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

    const { wrapper } = mountView(EventEdit, {
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

    const { wrapper } = mountView(SummerUniversityEdit, {
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

    const { wrapper } = mountView(StatutoryEdit, {
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
})
