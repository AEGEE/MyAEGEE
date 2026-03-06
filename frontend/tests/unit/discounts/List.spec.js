/* eslint-env jest */

import flushPromises from 'flush-promises'

import List from 'src/views/discounts/List.vue'

import {
  integrationsResponse,
  managerPermissions,
  services,
  unrelatedPermissions
} from './fixtures'
import { createAxiosMock, mountDiscountsView } from './test-utils'

describe('Discounts integrations list', () => {
  test('shows create action when management permission is present', async () => {
    const axios = createAxiosMock({
      get: {
        '/api/discounts/integrations': { data: { data: integrationsResponse } },
        '/api/core/my_permissions': { data: { data: managerPermissions } }
      }
    })

    const { wrapper, showError } = mountDiscountsView(List, { axios, services })

    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(wrapper.vm.integrations).toEqual(integrationsResponse)
    expect(wrapper.vm.can.create).toEqual(true)
  })

  test('hides create action when permissions are unrelated', async () => {
    const axios = createAxiosMock({
      get: {
        '/api/discounts/integrations': { data: { data: integrationsResponse } },
        '/api/core/my_permissions': { data: { data: unrelatedPermissions } }
      }
    })

    const { wrapper } = mountDiscountsView(List, { axios, services })

    await flushPromises()

    expect(wrapper.vm.can.create).toEqual(false)
  })

  test('surfaces an error when permissions fetch fails after integrations load', async () => {
    const failure = new Error('permissions failed')
    const axios = createAxiosMock({
      get: {
        '/api/discounts/integrations': { data: { data: integrationsResponse } },
        '/api/core/my_permissions': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountDiscountsView(List, { axios, services })

    await flushPromises()

    expect(wrapper.vm.integrations).toEqual(integrationsResponse)
    expect(showError).toHaveBeenCalledWith('Could not fetch integrations list', failure)
  })
})
