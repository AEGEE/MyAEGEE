/* eslint-env jest */

import flushPromises from 'flush-promises'

import CategoryEdit from 'src/views/discounts/CategoryEdit.vue'

import { services } from './fixtures'
import { createAxiosMock, mountDiscountsView } from './test-utils'

describe('Discounts edit category', () => {
  test('saves a category and redirects to the categories list', async () => {
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      post: {
        '/api/discounts/categories/': { data: { data: {} } }
      }
    })

    const { wrapper, showError, showSuccess } = mountDiscountsView(CategoryEdit, {
      axios,
      services,
      router
    })

    wrapper.vm.category = {
      name: 'Travel',
      discounts: [{
        name: 'FlixBus',
        icon: 'bus',
        shortDescription: 'short',
        longDescription: 'long'
      }]
    }

    await wrapper.vm.saveCategory()
    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('Category is saved.')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.discounts.categories.list' })
  })

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

  test('redirects when the requested category is missing', async () => {
    const failure = {
      response: {
        status: 404
      }
    }
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/discounts/categories/3': () => Promise.reject(failure)
      }
    })

    const { showError } = mountDiscountsView(CategoryEdit, {
      axios,
      services,
      route: { params: { id: 3 } },
      router
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Category is not found')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.discounts.categories.list' })
  })

  test('handles missing response data when saving fails', async () => {
    const failure = new Error('network failed')
    const axios = createAxiosMock({
      post: {
        '/api/discounts/categories/': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountDiscountsView(CategoryEdit, {
      axios,
      services,
      route: { params: {} }
    })

    wrapper.setData({
      category: {
        name: 'Travel',
        discounts: [{
          name: 'Rail',
          icon: 'train',
          shortDescription: 'Save money',
          longDescription: 'Long description'
        }]
      }
    })

    await wrapper.vm.saveCategory()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Could not save category', failure)
    expect(wrapper.vm.isSaving).toEqual(false)
    expect(wrapper.vm.errors).toEqual({})
  })

  test('handles missing response data when loading fails', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/discounts/categories/5': () => Promise.reject(failure)
      }
    })

    const { showError } = mountDiscountsView(CategoryEdit, {
      axios,
      services,
      route: { params: { id: 5 } },
      router
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.discounts.categories.list' })
  })
})
