/* eslint-env jest */

import flushPromises from 'flush-promises'

import Vuex from 'vuex'
import { createLocalVue, shallowMount } from '@vue/test-utils'
import filters from 'src/filters'

import EventApply from 'src/views/events/Apply.vue'
import SummerUniversityApply from 'src/views/summeruniversity/Apply.vue'
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
      $buefy: { dialog: { confirm: jest.fn() } }
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
      'b-checkbox': true
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
})
