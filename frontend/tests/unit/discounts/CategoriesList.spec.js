/* eslint-env jest */

import flushPromises from 'flush-promises'

import CategoriesList from 'src/views/discounts/CategoriesList.vue'

import {
  categoriesResponse,
  managerPermissions,
  services
} from './fixtures'
import { createAxiosMock, mountDiscountsView } from './test-utils'

describe('Discounts categories list', () => {
  test('removes a category after successful deletion', async () => {
    const categories = [{ id: 3, ...categoriesResponse[0] }]
    const axios = createAxiosMock({
      get: {
        '/api/discounts/categories': { data: { data: categories } },
        '/api/core/my_permissions': { data: { data: managerPermissions } }
      },
      del: {
        '/api/discounts/categories/3': { data: {} }
      }
    })

    const { wrapper, showError, showSuccess } = mountDiscountsView(CategoriesList, { axios, services })

    await flushPromises()
    await wrapper.vm.deleteCategory(0)
    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('Category is deleted.')
    expect(wrapper.vm.categories).toEqual([])
  })
})
