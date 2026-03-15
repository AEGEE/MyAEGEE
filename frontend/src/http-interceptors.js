function registerAxiosInterceptors ({ axios, Vue, router, state, getCurrentRoute }) {
  let renewalPromise = null

  axios.interceptors.request.use(config => {
    const token = window.localStorage.getItem('access-token')
    config.headers['X-Auth-Token'] = token
    return config
  })

  axios.interceptors.response.use(
    response => response,
    error => {
      const originalRequest = error.config
      if (axios.isCancel(error) || !error.response || error.response.status !== 401 || originalRequest._retry) {
        return Promise.reject(error)
      }

      console.debug('Token expired, renewing...')
      originalRequest._retry = true

      const refreshToken = window.localStorage.getItem('refresh-token')
      if (!refreshToken) {
        console.debug('No refresh token provided')

        if (!originalRequest.headers['X-For-Auth']) {
          const route = getCurrentRoute()
          const prefix = route.name === 'oms.login' ? '' : '?to=' + encodeURI(route.fullPath)
          router.push('/login' + prefix)
        }
        return Promise.reject(error)
      }

      if (!renewalPromise) {
        renewalPromise = Vue.axios.post(state.services['core'] + '/renew', { refresh_token: refreshToken })
          .then((result) => {
            console.debug('Renew access token successfully.')
            window.localStorage.setItem('access-token', result.data.access_token)
            if (result.data.refresh_token) {
              window.localStorage.setItem('refresh-token', result.data.refresh_token)
            }
            return result.data.access_token
          })
          .catch((renewError) => {
            console.debug('Token renewal failed:', renewError)
            window.localStorage.removeItem('access-token')
            window.localStorage.removeItem('refresh-token')
            if (!originalRequest.headers['X-For-Auth']) {
              const route = getCurrentRoute()
              const prefix = route.name === 'oms.login' ? '' : '?to=' + encodeURI(route.fullPath)
              router.push('/login' + prefix)
            }
            throw renewError
          })
          .finally(() => { renewalPromise = null })
      }

      return renewalPromise.then((newToken) => {
        originalRequest.headers['X-Auth-Token'] = newToken
        return axios(originalRequest)
      })
    }
  )
}

export { registerAxiosInterceptors }
export default registerAxiosInterceptors
