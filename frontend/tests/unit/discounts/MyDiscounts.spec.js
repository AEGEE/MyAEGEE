import flushPromises from 'flush-promises'

import MyDiscounts from 'src/views/discounts/MyDiscounts.vue'

import {
  claimResponse,
  claimedCodesResponse,
  integrationsResponse,
  services
} from './fixtures'
import { createAxiosMock, mountDiscountsView } from './test-utils'

describe('MyDiscounts', () => {
  test('loads claimed codes and selects the first integration by default', async () => {
    const axios = createAxiosMock({
      get: {
        '/api/discounts/codes/mine': { data: { data: claimedCodesResponse } },
        '/api/discounts/integrations': { data: { data: integrationsResponse } }
      }
    })

    const { wrapper, showError } = mountDiscountsView(MyDiscounts, { axios, services })

    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(wrapper.vm.codes).toEqual(claimedCodesResponse)
    expect(wrapper.vm.integrations).toEqual(integrationsResponse)
    expect(wrapper.vm.selectedIntegration).toEqual(integrationsResponse[0].id)
    expect(wrapper.vm.isLoading).toEqual(false)
  })

  test('adds integration data locally after a successful claim', async () => {
    const axios = createAxiosMock({
      get: {
        '/api/discounts/codes/mine': { data: { data: claimedCodesResponse } },
        '/api/discounts/integrations': { data: { data: integrationsResponse } }
      },
      post: {
        '/api/discounts/integrations/7/claim': { data: { data: { ...claimResponse } } }
      }
    })

    const { wrapper, showError, showSuccess } = mountDiscountsView(MyDiscounts, { axios, services })

    await flushPromises()
    await wrapper.vm.claimCode()
    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('Code is added.')
    expect(wrapper.vm.codes[0].value).toEqual('NEW-CODE')
    expect(wrapper.vm.codes[0].integration).toEqual(integrationsResponse[0])
  })

  test('surfaces an error when integrations fetch fails after codes load', async () => {
    const failure = new Error('integrations failed')
    const axios = createAxiosMock({
      get: {
        '/api/discounts/codes/mine': { data: { data: claimedCodesResponse } },
        '/api/discounts/integrations': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountDiscountsView(MyDiscounts, { axios, services })

    await flushPromises()

    expect(wrapper.vm.codes).toEqual(claimedCodesResponse)
    expect(wrapper.vm.isLoading).toEqual(false)
    expect(showError).toHaveBeenCalledWith('Could not fetch discounts', failure)
  })

  test('shows an error instead of claiming when no integration is selected', async () => {
    const axios = createAxiosMock({
      get: {
        '/api/discounts/codes/mine': { data: { data: [] } },
        '/api/discounts/integrations': { data: { data: [] } }
      }
    })

    const { wrapper, showError, showSuccess } = mountDiscountsView(MyDiscounts, { axios, services })

    await flushPromises()
    await wrapper.vm.claimCode()

    expect(showSuccess).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledWith('Please select a partner first.')
  })
})
