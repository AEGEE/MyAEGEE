/* eslint-env jest */

jest.mock('vuex-store', () => ({
  dispatch: jest.fn()
}))

jest.mock('src/services', () => ({
  core: '/api/core'
}))

import store from 'vuex-store'
import auth from 'src/auth'

describe('auth plugin', () => {
  let VueStub
  let authApi

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()

    VueStub = {
      axios: {
        post: jest.fn(),
        get: jest.fn()
      },
      prototype: {}
    }

    auth.install(VueStub)
    authApi = VueStub.prototype.$auth
  })

  test('login stores tokens and dispatches login on success', async () => {
    VueStub.axios.post.mockResolvedValue({
      data: {
        success: true,
        access_token: 'access-1',
        refresh_token: 'refresh-1'
      }
    })

    await authApi.login({ username: 'user', password: 'pass' })

    expect(VueStub.axios.post).toHaveBeenCalledWith('/api/core/login', { username: 'user', password: 'pass' })
    expect(window.localStorage.getItem('access-token')).toEqual('access-1')
    expect(window.localStorage.getItem('refresh-token')).toEqual('refresh-1')
    expect(store.dispatch).toHaveBeenCalledWith('login')
  })

  test('login throws backend payload on failure without storing tokens', async () => {
    VueStub.axios.post.mockResolvedValue({ data: { success: false, message: 'bad credentials' } })

    await expect(authApi.login({ username: 'user', password: 'bad' })).rejects.toEqual({ success: false, message: 'bad credentials' })
    expect(window.localStorage.getItem('access-token')).toEqual(null)
    expect(store.dispatch).not.toHaveBeenCalled()
  })

  test('fetchUser fails early when both tokens are absent', async () => {
    await expect(authApi.fetchUser()).rejects.toThrow('Both access and refresh token are not present.')
    expect(VueStub.axios.get).not.toHaveBeenCalled()
  })

  test('fetchUser loads the current user and dispatches setUser', async () => {
    window.localStorage.setItem('access-token', 'access-1')
    VueStub.axios.get.mockResolvedValue({
      data: {
        success: true,
        data: { id: 1, username: 'valid_user' }
      }
    })

    const user = await authApi.fetchUser()

    expect(VueStub.axios.get).toHaveBeenCalledWith('/api/core/members/me', {
      headers: { 'X-For-Auth': 'true' }
    })
    expect(store.dispatch).toHaveBeenCalledWith('setUser', { id: 1, username: 'valid_user' })
    expect(user).toEqual({ id: 1, username: 'valid_user' })
  })

  test('fetchUser throws backend payload when response is unsuccessful', async () => {
    window.localStorage.setItem('access-token', 'access-1')
    VueStub.axios.get.mockResolvedValue({ data: { success: false, message: 'nope' } })

    await expect(authApi.fetchUser()).rejects.toEqual({ success: false, message: 'nope' })
  })

  test('fetchUserWithExistingData loads user and permissions', async () => {
    window.localStorage.setItem('access-token', 'access-1')
    VueStub.axios.get
      .mockResolvedValueOnce({ data: { success: true, data: { id: 1, username: 'valid_user' } } })
      .mockResolvedValueOnce({ data: { success: true, data: ['perm:1'] } })

    await authApi.fetchUserWithExistingData()

    expect(store.dispatch).toHaveBeenCalledWith('setUser', { id: 1, username: 'valid_user' })
    expect(store.dispatch).toHaveBeenCalledWith('setPermissions', ['perm:1'])
    expect(store.dispatch).not.toHaveBeenCalledWith('logout')
  })

  test('fetchUserWithExistingData logs out on failure', async () => {
    window.localStorage.setItem('access-token', 'access-1')
    VueStub.axios.get.mockRejectedValue(new Error('boom'))

    await expect(authApi.fetchUserWithExistingData()).rejects.toThrow('Cannot authorize, need to relogin.')
    expect(store.dispatch).toHaveBeenCalledWith('logout')
  })

  test('logout posts refresh token, clears storage, and dispatches logout', async () => {
    window.localStorage.setItem('refresh-token', 'refresh-1')
    window.localStorage.setItem('access-token', 'access-1')
    VueStub.axios.post.mockResolvedValue({ data: { success: true } })

    await authApi.logout()

    expect(VueStub.axios.post).toHaveBeenCalledWith('/api/core/logout', { refresh_token: 'refresh-1' })
    expect(window.localStorage.getItem('access-token')).toEqual(null)
    expect(window.localStorage.getItem('refresh-token')).toEqual(null)
    expect(store.dispatch).toHaveBeenCalledWith('logout')
  })

  test('logout still clears storage when the API call fails', async () => {
    window.localStorage.setItem('refresh-token', 'refresh-1')
    window.localStorage.setItem('access-token', 'access-1')
    VueStub.axios.post.mockRejectedValue(new Error('logout failed'))

    await authApi.logout()

    expect(window.localStorage.getItem('access-token')).toEqual(null)
    expect(window.localStorage.getItem('refresh-token')).toEqual(null)
    expect(store.dispatch).toHaveBeenCalledWith('logout')
  })
})
