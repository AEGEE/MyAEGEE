/* eslint-env jest */

import { registerAxiosInterceptors } from 'src/http-interceptors'

describe('axios renew interceptor', () => {
  function setup () {
    const requestUse = jest.fn()
    const responseUse = jest.fn()
    const retryRequest = jest.fn(() => Promise.resolve({ data: { success: true } }))
    retryRequest.interceptors = {
      request: { use: requestUse },
      response: { use: responseUse }
    }
    retryRequest.isCancel = jest.fn(() => false)

    const renewPost = jest.fn()
    const router = { push: jest.fn() }
    const route = { name: 'oms.events.view', fullPath: '/events/17' }

    registerAxiosInterceptors({
      axios: retryRequest,
      Vue: { axios: { post: renewPost } },
      router,
      state: { services: { core: '/api/core' } },
      getCurrentRoute: () => route
    })

    const responseErrorHandler = responseUse.mock.calls[0][1]
    const requestHandler = requestUse.mock.calls[0][0]

    return {
      retryRequest,
      renewPost,
      router,
      route,
      responseErrorHandler,
      requestHandler
    }
  }

  beforeEach(() => {
    window.localStorage.clear()
  })

  test('adds the stored access token to outgoing requests', () => {
    const { requestHandler } = setup()
    window.localStorage.setItem('access-token', 'token-123')

    const config = requestHandler({ headers: {} })

    expect(config.headers['X-Auth-Token']).toEqual('token-123')
  })

  test('renews the token and retries the original request on 401', async () => {
    const { renewPost, retryRequest, responseErrorHandler } = setup()
    window.localStorage.setItem('refresh-token', 'refresh-123')
    renewPost.mockResolvedValue({ data: { access_token: 'new-token' } })

    const result = await responseErrorHandler({
      config: { headers: {}, url: '/api/core/members/me' },
      response: { status: 401 }
    })

    expect(renewPost).toHaveBeenCalledWith('/api/core/renew', { refresh_token: 'refresh-123' })
    expect(window.localStorage.getItem('access-token')).toEqual('new-token')
    expect(retryRequest).toHaveBeenCalledWith(expect.objectContaining({
      _retry: true,
      headers: expect.objectContaining({ 'X-Auth-Token': 'new-token' })
    }))
    expect(result).toEqual({ data: { success: true } })
  })

  test('stores the new refresh token when backend returns one', async () => {
    const { renewPost, responseErrorHandler } = setup()
    window.localStorage.setItem('refresh-token', 'refresh-123')
    renewPost.mockResolvedValue({ data: { access_token: 'new-token', refresh_token: 'new-refresh' } })

    await responseErrorHandler({
      config: { headers: {}, url: '/api/core/members/me' },
      response: { status: 401 }
    })

    expect(window.localStorage.getItem('refresh-token')).toEqual('new-refresh')
  })

  test('keeps existing refresh token when backend does not return one', async () => {
    const { renewPost, responseErrorHandler } = setup()
    window.localStorage.setItem('refresh-token', 'refresh-123')
    renewPost.mockResolvedValue({ data: { access_token: 'new-token' } })

    await responseErrorHandler({
      config: { headers: {}, url: '/api/core/members/me' },
      response: { status: 401 }
    })

    expect(window.localStorage.getItem('refresh-token')).toEqual('refresh-123')
  })

  test('redirects to login when no refresh token is available', async () => {
    const { router, responseErrorHandler } = setup()

    await expect(responseErrorHandler({
      config: { headers: {}, url: '/api/core/members/me' },
      response: { status: 401 }
    })).rejects.toBeTruthy()

    expect(router.push).toHaveBeenCalledWith('/login?to=/events/17')
  })

  test('does not redirect auth bootstrap requests without a refresh token', async () => {
    const { router, responseErrorHandler } = setup()

    await expect(responseErrorHandler({
      config: { headers: { 'X-For-Auth': 'true' }, url: '/api/core/members/me' },
      response: { status: 401 }
    })).rejects.toBeTruthy()

    expect(router.push).not.toHaveBeenCalled()
  })

  test('redirects to login when token renewal fails', async () => {
    const { renewPost, router, responseErrorHandler } = setup()
    window.localStorage.setItem('refresh-token', 'refresh-123')
    window.localStorage.setItem('access-token', 'old-token')
    renewPost.mockRejectedValue(new Error('Network Error'))

    await expect(responseErrorHandler({
      config: { headers: {}, url: '/api/core/members/me' },
      response: { status: 401 }
    })).rejects.toThrow('Network Error')

    expect(window.localStorage.getItem('access-token')).toBeNull()
    expect(window.localStorage.getItem('refresh-token')).toBeNull()
    expect(router.push).toHaveBeenCalledWith('/login?to=/events/17')
  })

  test('does not redirect auth bootstrap requests when renewal fails', async () => {
    const { renewPost, router, responseErrorHandler } = setup()
    window.localStorage.setItem('refresh-token', 'refresh-123')
    renewPost.mockRejectedValue(new Error('403'))

    await expect(responseErrorHandler({
      config: { headers: { 'X-For-Auth': 'true' }, url: '/api/core/members/me' },
      response: { status: 401 }
    })).rejects.toThrow()

    expect(router.push).not.toHaveBeenCalled()
  })

  test('concurrent 401s share a single renewal request', async () => {
    const { renewPost, retryRequest, responseErrorHandler } = setup()
    window.localStorage.setItem('refresh-token', 'refresh-123')

    let resolveRenewal
    renewPost.mockReturnValue(new Promise((resolve) => {
      resolveRenewal = resolve
    }))

    const error401 = (url) => ({
      config: { headers: {}, url },
      response: { status: 401 }
    })

    const promise1 = responseErrorHandler(error401('/api/core/members/me'))
    const promise2 = responseErrorHandler(error401('/api/core/my_permissions'))

    resolveRenewal({ data: { access_token: 'shared-token' } })

    await Promise.all([promise1, promise2])

    expect(renewPost).toHaveBeenCalledTimes(1)
    expect(retryRequest).toHaveBeenCalledTimes(2)
    expect(retryRequest).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({ 'X-Auth-Token': 'shared-token' })
    }))
  })

  test('rejects non-401 errors without attempting renewal', async () => {
    const { renewPost, responseErrorHandler } = setup()

    await expect(responseErrorHandler({
      config: { headers: {} },
      response: { status: 500 }
    })).rejects.toBeTruthy()

    expect(renewPost).not.toHaveBeenCalled()
  })

  test('rejects cancelled requests without attempting renewal', async () => {
    const { renewPost, retryRequest, responseErrorHandler } = setup()
    retryRequest.isCancel = jest.fn(() => true)

    await expect(responseErrorHandler({
      config: { headers: {} }
    })).rejects.toBeTruthy()

    expect(renewPost).not.toHaveBeenCalled()
  })
})
