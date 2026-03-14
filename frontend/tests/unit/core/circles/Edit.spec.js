/* eslint-env jest */

import flushPromises from 'flush-promises'

import EditCircle from 'src/views/core/circles/Edit.vue'

import { createAxiosMock, mountFrontendView } from '../../test-utils'

describe('Core circle edit', () => {
  test('redirects to the circles list when load fails without response data', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/core/circles/7': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(EditCircle, {
      axios,
      router,
      route: { params: { id: '7' } },
      services: { core: '/api/core' }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.circles.list' })
  })

  test('shows a generic error when saving fails without response data', async () => {
    const failure = new Error('network failed')
    const axios = createAxiosMock({
      post: {
        '/api/core/circles/': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountFrontendView(EditCircle, {
      axios,
      route: { params: {} },
      services: { core: '/api/core' }
    })

    wrapper.vm.circle.name = 'New circle'
    wrapper.vm.circle.description = 'Description'
    await wrapper.vm.saveCircle()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Could not save circle', failure)
    expect(wrapper.vm.isSaving).toEqual(false)
  })

  test('shows a generic error when setting parent circle fails without response data', async () => {
    const failure = new Error('network failed')
    const axios = createAxiosMock({
      put: {
        '/api/core/circles/7/parent': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountFrontendView(EditCircle, {
      axios,
      route: { params: { id: '7' } },
      services: { core: '/api/core' }
    })

    await wrapper.vm.setParentCircle({ id: 3, name: 'Parent circle' })
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Could not set parent circle', failure)
    expect(wrapper.vm.autoComplete.parentCircle.loading).toEqual(false)
  })
})
