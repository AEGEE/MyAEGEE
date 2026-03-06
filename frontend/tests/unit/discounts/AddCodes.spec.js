/* eslint-env jest */

import flushPromises from 'flush-promises'

import AddCodes from 'src/views/discounts/AddCodes.vue'

import { services } from './fixtures'
import { createAxiosMock, mountDiscountsView } from './test-utils'

describe('AddCodes', () => {
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
})
