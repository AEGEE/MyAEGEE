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
})
