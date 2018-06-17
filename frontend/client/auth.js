import store from 'vuex-store'
import services from './services'

export default {
  install (Vue) {
    const login = async (params) => {
      const res = await Vue.axios.post(services['oms-core-elixir'] + '/login', params)
      if (!res.data.success) {
        throw res.data
      }

      window.localStorage.setItem('access-token', res.data.access_token)
      window.localStorage.setItem('refresh-token', res.data.refresh_token)
      store.dispatch('login')
    }

    const renew = async (refreshToken) => {
      if (!refreshToken) {
        throw new Error('Cannot renew access token without refresh token')
      }

      const result = await Vue.axios.post(services['oms-core-elixir'] + '/renew', { refresh_token: refreshToken })
      if (!result.data.success) {
        throw result.data
      }

      window.localStorage.setItem('access-token', result.data.access_token)
    }

    const fetchUser = async (accessToken) => {
      if (!accessToken) {
        throw new Error('Cannot fetch user without access token')
      }

      const result = await Vue.axios.get(services['oms-core-elixir'] + '/members/me', {
        headers: { 'X-Auth-Token': accessToken }
      })

      if (!result.data.success) {
        throw result.data
      }

      store.dispatch('setUser', result.data.data)
      return result.data.data
    }

    const fetchUserWithExistingData = async () => {
      const accessToken = window.localStorage.getItem('access-token')
      const refreshToken = window.localStorage.getItem('refresh-token')

      if (!accessToken && !refreshToken) {
        // User is not logged in/has cleared the localStorage
        throw new Error('Cannot authorize, both access and refresh tokens are not presented.')
      }

      // First, trying to fetch the user with access token.
      try {
        await fetchUser(accessToken)
        return
      } catch (err) {
        console.log('Could not fetch user with access token')
      }

      // If that failed, trying to obtain new access token and load the user again.
      try {
        await renew(refreshToken)

        const newAccessToken = window.localStorage.getItem('access-token')
        await fetchUser(newAccessToken)
      } catch (err) {
        // everything failed, redirect to login
        store.dispatch('logout')
        throw new Error('Cannot authorize, need to relogin.')
      }
    }

    const logout = async () => {
      const accessToken = window.localStorage.getItem('access-token')
      try {
        await Vue.axios.post(services['oms-core-elixir'] + '/logout', null, {
          headers: { 'X-Auth-Token': accessToken }
        })
      } catch (err) {
        console.log('Error logging out')
      }
      window.localStorage.removeItem('access-token')
      window.localStorage.removeItem('refresh-token')
      store.dispatch('logout')
    }

    Object.defineProperties(Vue.prototype, {
      $auth: {
        get () {
          return {
            login,
            logout,
            renew,
            fetchUserWithExistingData,
            fetchUser
          }
        }
      }
    })
  }
}
