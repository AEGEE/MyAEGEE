/* eslint-env jest */

import flushPromises from 'flush-promises'

import EventApply from 'src/views/events/Apply.vue'

import { createAxiosMock, createRejectedAxiosError, mountFrontendView } from '../test-utils'

describe('Events apply flow', () => {
  test('creates a new application and redirects to the event view', async () => {
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/events/single/17': { data: { data: { id: 17, url: 'spring-agora', questions: [], application_status: 'open', status: 'published' } } },
        '/api/events/single/17/applications/me': () => Promise.reject(createRejectedAxiosError('Not found', { status: 404 }))
      },
      post: {
        '/api/events/single/17/applications': { data: { success: true } }
      }
    })

    const { wrapper, showError, showSuccess } = mountFrontendView(EventApply, {
      axios,
      router,
      route: { params: { id: '17', application_id: 'me' } },
      services: { events: '/api/events' },
      user: { id: 1, bodies: [{ id: 3 }] }
    })

    await flushPromises()

    wrapper.setData({
      event: { id: 17, url: 'spring-agora' },
      application: {
        id: null,
        body_id: 3,
        answers: ['Answer'],
        agreed_to_privacy_policy: true
      }
    })

    await wrapper.vm.saveApplication()
    await flushPromises()

    expect(axios.post).toHaveBeenCalledWith('/api/events/single/17/applications', {
      body_id: 3,
      answers: ['Answer'],
      agreed_to_privacy_policy: true
    })
    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('Your application was saved, you can still edit it until the application period ends')
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.view', params: { id: 'spring-agora' } })
  })

  test('updates an existing application and redirects to the event view', async () => {
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/events/single/17': { data: { data: { id: 17, url: null, questions: [], application_status: 'open', status: 'published' } } },
        '/api/events/single/17/applications/42': { data: { data: { id: 42, body_id: 3, answers: ['Updated answer'], agreed_to_privacy_policy: false } } }
      },
      put: {
        '/api/events/single/17/applications/42': { data: { success: true } }
      }
    })

    const { wrapper, showSuccess } = mountFrontendView(EventApply, {
      axios,
      router,
      route: { params: { id: '17', application_id: '42' } },
      services: { events: '/api/events' },
      user: { id: 1, bodies: [{ id: 3 }] }
    })

    await flushPromises()

    wrapper.setData({
      event: { id: 17, url: null },
      application: {
        id: 42,
        body_id: 3,
        answers: ['Updated answer'],
        agreed_to_privacy_policy: false
      }
    })

    await wrapper.vm.saveApplication()
    await flushPromises()

    expect(axios.put).toHaveBeenCalledWith('/api/events/single/17/applications/42', {
      body_id: 3,
      answers: ['Updated answer'],
      agreed_to_privacy_policy: false
    })
    expect(showSuccess).toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.events.view', params: { id: 17 } })
  })

  test('surfaces backend validation errors when saving fails', async () => {
    const validationError = {
      response: {
        status: 422,
        data: {
          errors: {
            answers: ['Answer is required']
          }
        }
      }
    }
    const axios = createAxiosMock({
      get: {
        '/api/events/single/17': { data: { data: { id: 17, url: null, questions: [], application_status: 'open', status: 'published' } } },
        '/api/events/single/17/applications/me': () => Promise.reject(createRejectedAxiosError('Not found', { status: 404 }))
      },
      post: {
        '/api/events/single/17/applications': () => Promise.reject(validationError)
      }
    })

    const { wrapper, showError } = mountFrontendView(EventApply, {
      axios,
      route: { params: { id: '17', application_id: 'me' } },
      services: { events: '/api/events' },
      user: { id: 1, bodies: [{ id: 3 }] }
    })

    await flushPromises()

    wrapper.setData({
      application: {
        id: null,
        body_id: 3,
        answers: [''],
        agreed_to_privacy_policy: true
      }
    })

    await wrapper.vm.saveApplication()
    await flushPromises()

    expect(wrapper.vm.errors).toEqual({ answers: ['Answer is required'] })
    expect(showError).toHaveBeenCalledWith('Some of the application data is invalid.')
    expect(wrapper.vm.isSaving).toEqual(false)
  })
})
