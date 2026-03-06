/* eslint-env jest */

import flushPromises from 'flush-promises'

import Edit from 'src/views/discounts/Edit.vue'

import { integrationsResponse, services } from './fixtures'
import { createAxiosMock, mountDiscountsView } from './test-utils'

describe('Edit integration', () => {
  test('saves a new integration and redirects to the list', async () => {
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      post: {
        '/api/discounts/integrations/': { data: { data: integrationsResponse[0] } }
      }
    })

    const { wrapper, showError, showSuccess } = mountDiscountsView(Edit, { axios, services, router })

    wrapper.vm.integration = { ...integrationsResponse[0] }
    await wrapper.vm.saveIntegration()
    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('Integration is saved.')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.discounts.list' })
  })

  test('shows validation errors returned by the backend on save', async () => {
    const validationError = {
      response: {
        status: 422,
        data: {
          errors: {
            code: ['Code is already taken']
          }
        }
      }
    }
    const axios = createAxiosMock({
      post: {
        '/api/discounts/integrations/': () => Promise.reject(validationError)
      }
    })

    const { wrapper, showError } = mountDiscountsView(Edit, { axios, services })

    wrapper.vm.integration = { ...integrationsResponse[0] }
    await wrapper.vm.saveIntegration()
    await flushPromises()

    expect(wrapper.vm.errors).toEqual({ code: ['Code is already taken'] })
    expect(showError).toHaveBeenCalledWith('Some of the integration data is invalid.')
  })

  test('redirects to list when requested integration is missing', async () => {
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

    const { showError } = mountDiscountsView(Edit, {
      axios,
      services,
      route: { params: { id: 7 } },
      router
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Integration is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.discounts.list' })
  })

  test('shows a generic error when loading an integration fails with non-404 response', async () => {
    const failure = {
      response: {
        status: 403
      },
      message: 'Forbidden'
    }
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/discounts/integrations/7': () => Promise.reject(failure)
      }
    })

    const { showError } = mountDiscountsView(Edit, {
      axios,
      services,
      route: { params: { id: 7 } },
      router
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', 'Forbidden')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.discounts.list' })
  })
})
