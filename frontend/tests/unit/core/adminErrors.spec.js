/* eslint-env jest */

import flushPromises from 'flush-promises'

import UpdateProfile from 'src/views/core/members/UpdateProfile.vue'
import EditMember from 'src/views/core/members/Edit.vue'
import EditUser from 'src/views/core/members/EditUser.vue'
import EditBody from 'src/views/core/bodies/Edit.vue'
import EditPermission from 'src/views/core/permissions/Edit.vue'
import EditCampaign from 'src/views/core/campaigns/Edit.vue'

import { createAxiosMock, mountFrontendView } from '../test-utils'

describe('Core admin network error handling', () => {
  test('update profile redirects cleanly on member load network failure', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn(), go: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/core/members/me': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(UpdateProfile, {
      axios,
      router,
      services: { core: '/api/core' },
      stubs: { tooltip: true },
      getters: {
        loggedIn: () => true,
        isValid: () => false,
        validationErrors: () => ({ privacy: true, username: true })
      }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
  })

  test('member edit redirects cleanly on load network failure', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/core/members/7': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(EditMember, {
      axios,
      router,
      route: { params: { id: '7' } },
      services: { core: '/api/core' },
      stubs: { 'select-or-custom': true }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.members.list' })
  })

  test('password edit handles save network failures without crashing', async () => {
    const failure = new Error('network failed')
    const axios = createAxiosMock({
      get: {
        '/api/core/members/me': { data: { data: { id: 1, password: '' } } }
      },
      put: {
        '/api/core/members/me/password': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountFrontendView(EditUser, {
      axios,
      services: { core: '/api/core' },
      stubs: { 'password-toggle': true }
    })

    await flushPromises()
    wrapper.setData({ old_password: 'old-pass', password_confirmation: 'new-pass', user: { password: 'new-pass' } })
    await wrapper.vm.saveUser()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Could not save user', failure)
    expect(wrapper.vm.isSaving).toEqual(false)
  })

  test('body edit redirects cleanly on load network failure', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/core/bodies/8': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(EditBody, {
      axios,
      router,
      route: { params: { id: '8' } },
      services: { core: '/api/core' },
      stubs: { tooltip: true, MarkdownTooltip: true }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.bodies.list' })
  })

  test('permission edit handles save network failures without crashing', async () => {
    const failure = new Error('network failed')
    const axios = createAxiosMock({
      post: {
        '/api/core/permissions/': () => Promise.reject(failure)
      }
    })

    const { wrapper, showError } = mountFrontendView(EditPermission, {
      axios,
      route: { params: {} },
      services: { core: '/api/core' }
    })

    wrapper.vm.permission = { scope: 'global', action: 'view', object: 'member', filters: [] }
    await wrapper.vm.savePermission()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Could not save permission', failure)
    expect(wrapper.vm.isSaving).toEqual(false)
  })

  test('campaign edit redirects cleanly on load network failure', async () => {
    const failure = new Error('network failed')
    const router = { push: jest.fn() }
    const axios = createAxiosMock({
      get: {
        '/api/core/bodies/': { data: { data: [] } },
        '/api/core/campaigns/9': () => Promise.reject(failure)
      }
    })

    const { showError } = mountFrontendView(EditCampaign, {
      axios,
      router,
      route: { params: { id: '9' } },
      services: { core: '/api/core' },
      stubs: { MarkdownTooltip: true }
    })

    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Some error happened', failure)
    expect(router.push).toHaveBeenCalledWith({ name: 'oms.campaigns.list' })
  })
})
