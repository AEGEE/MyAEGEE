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

    const fetchUser = async () => {
      const result = await Vue.axios.get(services['oms-core-elixir'] + '/members/me')

      if (!result.data.success) {
        throw result.data
      }

      store.dispatch('setUser', result.data.data)
      return result.data.data
    }

    const fetchPermissions = async () => {
      const result = await Vue.axios.get(services['oms-core-elixir'] + '/my_permissions')

      if (!result.data.success) {
        throw result.data
      }

      store.dispatch('setPermissions', result.data.data)
      return result.data.data
    }

    const fetchUserWithExistingData = async () => {
      try {
        await fetchUser() // The request will be re-done and access token will be renewed if expired.
        await fetchPermissions()
        return
      } catch (err) {
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
            fetchUserWithExistingData,
            fetchUser
          }
        }
      }
    })
  }
}
