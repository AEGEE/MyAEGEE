/* eslint-env jest */

import flushPromises from 'flush-promises'

import CategoryEdit from 'src/views/discounts/CategoryEdit.vue'

import { services } from './fixtures'
import { createAxiosMock, mountDiscountsView } from './test-utils'

describe('CategoryEdit', () => {
  test('requires at least one discount before saving', async () => {
    const axios = createAxiosMock()

    const { wrapper, showError, showSuccess } = mountDiscountsView(CategoryEdit, { axios, services })

    wrapper.vm.category.name = 'Travel'
    await wrapper.vm.saveCategory()

    expect(showSuccess).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledWith('Please add at least 1 discount for this category.')
  })

  test('shows validation errors returned by the backend', async () => {
    const validationError = {
      response: {
        status: 422,
        data: {
          errors: {
            name: ['Name is required']
          }
        }
      }
    }
    const axios = createAxiosMock({
      post: {
        '/api/discounts/categories/': () => Promise.reject(validationError)
      }
    })

    const { wrapper, showError } = mountDiscountsView(CategoryEdit, { axios, services })

    wrapper.vm.category = {
      name: '',
      discounts: [{
        name: 'FlixBus',
        icon: 'bus',
        shortDescription: 'short',
        longDescription: 'long'
      }]
    }

    await wrapper.vm.saveCategory()
    await flushPromises()

    expect(wrapper.vm.errors).toEqual({ name: ['Name is required'] })
    expect(showError).toHaveBeenCalledWith('Some of the category data is invalid.')
  })
})
