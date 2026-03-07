/* eslint-env jest */

const createStubComponent = (name) => ({ name, render: (h) => h('div') })

jest.mock('vue-mapbox', () => ({
  MglMap: createStubComponent('MglMap'),
  MglMarker: createStubComponent('MglMarker'),
  MglPopup: createStubComponent('MglPopup'),
  MglNavigationControl: createStubComponent('MglNavigationControl')
}))

import flushPromises from 'flush-promises'

import StatutorySingle from 'src/views/statutory/Single.vue'
import StatutoryEditApplication from 'src/views/statutory/EditApplication.vue'
import StatutoryApplications from 'src/views/statutory/Applications.vue'
import StatutoryIncoming from 'src/views/statutory/Incoming.vue'
import StatutoryPositionsList from 'src/views/statutory/PositionsList.vue'
import StatutoryNetworkListing from 'src/views/statutory/NetworkListing.vue'

import { createAxiosMock, mountFrontendView } from '../test-utils'

describe('Statutory route regressions', () => {
  test('statutory single redirects cleanly on network failure', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/statutory/events/17': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(StatutorySingle, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory', core: '/api/core', 'statutory-static': '/static/statutory' },
      stubs: { PictureModal: true }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.list.all' })
  })

  test('statutory edit application redirects cleanly on event load network failure', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/statutory/events/17': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(StatutoryEditApplication, {
      axios,
      router,
      route: { params: { id: '17', application_id: '5' } },
      services: { statutory: '/api/statutory', core: '/api/core' },
      user: { id: 1, bodies: [] }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.applications.view', params: { id: '17', application_id: '5' } })
  })

  test('statutory edit application handles save network failures without crashing', async () => {
    const failure = new Error('network failed')
    const axios = createAxiosMock({
      post: {
        '/api/statutory/events/17/applications': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountFrontendView(StatutoryEditApplication, {
      axios,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory', core: '/api/core' },
      user: { id: 1, bodies: [{ id: 3 }], primary_body_id: 3 }
    })

    wrapper.setData({
      application: {
        body_id: 3,
        answers: [],
        meals: 'Vegetarian',
        nationality: 'Dutch',
        number_of_events_visited: 0
      }
    })

    await wrapper.vm.saveApplication()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Could not save application', failure)
  })

  test('statutory applications list handles load network failures without crashing', async () => {
    const failure = new Error('network failed')
    const axios = createAxiosMock({
      get: {
        '/api/statutory/events/17': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(StatutoryApplications, {
      axios,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory' }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
  })

  test('statutory incoming redirects cleanly on network failure', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/statutory/events/17': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(StatutoryIncoming, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory' }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.list.all' })
  })

  test('statutory positions list redirects cleanly on network failure', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/core/bodies': { data: { data: [] } },
        '/api/statutory/events/17': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(StatutoryPositionsList, {
      axios,
      router,
      route: { params: { id: '17', prefix: 'all' } },
      services: { statutory: '/api/statutory', core: '/api/core' },
      stubs: { EditPositionModal: true, ViewCandidateModal: true }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.list.all' })
  })

  test('statutory network listing redirects cleanly on network failure', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/statutory/events/17': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(StatutoryNetworkListing, {
      axios,
      router,
      route: { params: { id: '17' } },
      services: { statutory: '/api/statutory' }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.statutory.list.all' })
  })
})
