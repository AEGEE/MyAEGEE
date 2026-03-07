/* eslint-env jest */

import flushPromises from 'flush-promises'

import DiscountsList from 'src/views/discounts/DiscountsList.vue'

import {
  categoriesResponse,
  managerPermissions,
  services,
  unrelatedPermissions
} from './fixtures'
import { createAxiosMock, mountDiscountsView } from './test-utils'

describe('DiscountsList', () => {
  test('shows management buttons when discounts permission is present', async () => {
    const axios = createAxiosMock({
      get: {
        '/api/discounts/categories': { data: { data: categoriesResponse } },
        '/api/core/my_permissions': { data: { data: managerPermissions } }
      }
    })

    const { wrapper, showError } = mountDiscountsView(DiscountsList, { axios, services })

    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(wrapper.vm.categories).toHaveLength(1)
    expect(wrapper.vm.categories[0].discounts[0].expanded).toEqual(false)
    expect(wrapper.vm.can.create).toEqual(true)
  })

  test('keeps management buttons hidden when permissions are unrelated', async () => {
    const axios = createAxiosMock({
      get: {
        '/api/discounts/categories': { data: { data: categoriesResponse } },
        '/api/core/my_permissions': { data: { data: unrelatedPermissions } }
      }
    })

    const { wrapper, showError } = mountDiscountsView(DiscountsList, { axios, services })

    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(wrapper.vm.can.create).toEqual(false)
  })

  test('surfaces an error when permissions fetch fails after categories load', async () => {
    const failure = new Error('permissions failed')
    const axios = createAxiosMock({
      get: {
        '/api/discounts/categories': { data: { data: categoriesResponse } },
        '/api/core/my_permissions': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountDiscountsView(DiscountsList, { axios, services })

    await flushPromises()

    expect(wrapper.vm.categories).toHaveLength(1)
    expect(showError).toHaveBeenCalledWith('Could not fetch categories list', failure)
    expect(wrapper.vm.isLoading).toEqual(false)
  })
})
