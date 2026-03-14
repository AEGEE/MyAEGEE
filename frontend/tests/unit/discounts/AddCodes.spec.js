/* eslint-env jest */

import flushPromises from 'flush-promises'

import AddCodes from 'src/views/discounts/AddCodes.vue'

import { services } from './fixtures'
import { createAxiosMock, mountDiscountsView } from './test-utils'

describe('Discounts add codes', () => {
  test('adds parsed codes and redirects back to the list', async () => {
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/discounts/integrations/7': { data: { data: { id: 7, name: 'FlixBus' } } }
      },
      post: {
        '/api/discounts/integrations/7/codes': { data: {} }
      }
    })

    const { wrapper, showError, showSuccess } = mountDiscountsView(AddCodes, {
      axios,
      services,
      route: { params: { id: 7 } },
      router
    })

    await flushPromises()

    wrapper.vm.codesRaw = 'AAA\nBBB\n'
    await wrapper.vm.addCodes()
    await flushPromises()

    expect(axios.post).toHaveBeenCalledWith('/api/discounts/integrations/7/codes', ['AAA', 'BBB'])
    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('Codes are added.')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.discounts.list' })
  })

  test('shows an error when submitting only empty lines', async () => {
    const axios = createAxiosMock({
      get: {
        '/api/discounts/integrations/7': { data: { data: { id: 7, name: 'FlixBus' } } }
      }
    })

    const { wrapper, showError, showSuccess } = mountDiscountsView(AddCodes, {
      axios,
      services,
      route: { params: { id: 7 } }
    })

    await flushPromises()

    wrapper.vm.codesRaw = '\n\n'
    await wrapper.vm.addCodes()

    expect(showSuccess).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledWith('Please add at least 1 not empty code.')
  })

  test('redirects to the list when the integration cannot be loaded', async () => {
    const failure = {
      response: {
        status: 404
      }
    }
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/discounts/integrations/7': () => Promise.reject(failure)
      }
    })

    const { showError } = mountDiscountsView(AddCodes, {
      axios,
      services,
      route: { params: { id: 7 } },
      router
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Integration is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.discounts.list' })
  })

  test('surfaces an error when adding codes fails', async () => {
    const failure = new Error('add failed')
    const axios = createAxiosMock({
      get: {
        '/api/discounts/integrations/7': { data: { data: { id: 7, name: 'FlixBus' } } }
      },
      post: {
        '/api/discounts/integrations/7/codes': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountDiscountsView(AddCodes, {
      axios,
      services,
      route: { params: { id: 7 } }
    })

    await flushPromises()

    wrapper.vm.codesRaw = 'AAA'
    await wrapper.vm.addCodes()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Could not add codes', failure)
  })

  test('handles missing response data when integration load fails', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/discounts/integrations/3': () => Promise.reject(failure)
      }
    })

    const { showError } = mountDiscountsView(AddCodes, {
      axios,
      services,
      route: { params: { id: 3 } },
      router
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.discounts.list' })
  })
})
