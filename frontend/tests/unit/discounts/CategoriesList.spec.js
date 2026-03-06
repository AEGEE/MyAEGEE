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
  test('shows categories and create access when permissions allow it', async () => {
    const categories = [{ id: 3, ...categoriesResponse[0] }]
    const axios = createAxiosMock({
      get: {
        '/api/discounts/categories': { data: { data: categories } },
        '/api/core/my_permissions': { data: { data: managerPermissions } }
      }
    })

    const { wrapper, showError } = mountDiscountsView(CategoriesList, { axios, services })

    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(wrapper.vm.categories).toEqual(categories)
    expect(wrapper.vm.can.create).toEqual(true)
  })

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

  test('surfaces an error when category deletion fails', async () => {
    const failure = new Error('delete failed')
    const categories = [{ id: 3, ...categoriesResponse[0] }]
    const axios = createAxiosMock({
      get: {
        '/api/discounts/categories': { data: { data: categories } },
        '/api/core/my_permissions': { data: { data: managerPermissions } }
      },
      del: {
        '/api/discounts/categories/3': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountDiscountsView(CategoriesList, { axios, services })

    await flushPromises()
    await wrapper.vm.deleteCategory(0)
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Could not delete category', failure)
    expect(wrapper.vm.categories).toHaveLength(1)
  })
})
