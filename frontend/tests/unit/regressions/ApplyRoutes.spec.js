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

  const wrapper = shallowMount(component, {
    localVue,
    store,
    mocks: {
      axios,
      $route: route,
      $router: router,
      $buefy: { dialog: { confirm: jest.fn() } },
      accessToken: 'test-token'
    },
    parentComponent: {
      methods: {
        showError
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
})
