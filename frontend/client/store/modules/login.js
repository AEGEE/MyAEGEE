import * as types from '../mutation-types'

const state = {
  isLoggedIn: false,
  user: null,
  permissions: []
}

const mutations = {
  [types.LOGIN] (state) {
    state.isLoggedIn = true
  },
  [types.SET_USER] (state, user) {
    state.isLoggedIn = true
    state.user = user
  },
  [types.SET_PERMISSIONS] (state, permissions) {
    state.permissions = permissions
  },
  [types.LOGOUT] (state) {
    state.isLoggedIn = false
    state.user = null
  }
}

export default {
  state,
  mutations
}
